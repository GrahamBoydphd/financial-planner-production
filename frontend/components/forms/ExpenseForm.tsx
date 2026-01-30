'use client';

import { useState, useEffect } from 'react';
import { api, ExpenseItem } from '@/lib/api';
import Tooltip from '@/components/ui/Tooltip';

interface Props {
  planId: string;
  onSuccess: () => void;
  itemToEdit?: ExpenseItem | null;
  onCancel?: () => void;
  currencySymbol?: string;
}

export default function ExpenseForm({ planId, onSuccess, itemToEdit, onCancel, currencySymbol = '$' }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('opex');
  const [amount, setAmount] = useState('');
  const [growth, setGrowth] = useState('0');
  const [startMonth, setStartMonth] = useState('1');
  const [endMonth, setEndMonth] = useState('');
  const [freq, setFreq] = useState('monthly');
  const [pctRevenue, setPctRevenue] = useState('');

  // Volatility State
  const [volType, setVolType] = useState('');
  const [volMin, setVolMin] = useState('');
  const [volMax, setVolMax] = useState('');
  const [numSteps, setNumSteps] = useState(''); // Changed from stepSize
  const [volScale, setVolScale] = useState('');
  const [volFreedom, setVolFreedom] = useState('');
  const [volAlpha, setVolAlpha] = useState('');
  const [volBeta, setVolBeta] = useState('');

  const [errors, setErrors] = useState<string[]>([]);

  // --- POPULATE ON EDIT ---
  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.expense_name);
      setCategory(itemToEdit.category);
      setAmount(itemToEdit.initial_amount.toString());
      setGrowth(itemToEdit.growth_rate_percent.toString());
      setStartMonth(itemToEdit.start_month.toString());
      setEndMonth(itemToEdit.end_month ? itemToEdit.end_month.toString() : '');
      setFreq(itemToEdit.frequency);
      setPctRevenue(itemToEdit.pct_of_revenue ? itemToEdit.pct_of_revenue.toString() : '');

      // Map legacy 'none' or null to '' to force selection, or use existing
      const vType = itemToEdit.volatility_type === 'none' ? '' : (itemToEdit.volatility_type || '');
      setVolType(vType);

      setVolMin(itemToEdit.vol_min ? itemToEdit.vol_min.toString() : '');
      setVolMax(itemToEdit.vol_max ? itemToEdit.vol_max.toString() : '');
      
      // Direct map for numSteps
      if (vType === 'flat' && itemToEdit.vol_intervals) {
          setNumSteps(itemToEdit.vol_intervals.toString());
      } else {
          setNumSteps('');
      }

      setVolScale(itemToEdit.vol_scale ? itemToEdit.vol_scale.toString() : '');
      setVolFreedom(itemToEdit.vol_freedom ? itemToEdit.vol_freedom.toString() : '');
      setVolAlpha(itemToEdit.vol_alpha ? itemToEdit.vol_alpha.toString() : '');
      setVolBeta(itemToEdit.vol_beta ? itemToEdit.vol_beta.toString() : '');
    } else {
      clearForm();
    }
  }, [itemToEdit]);

  const clearForm = () => {
    setName('');
    setCategory('opex');
    setAmount('');
    setGrowth('0');
    setStartMonth('1');
    setEndMonth('');
    setFreq('monthly');
    setPctRevenue('');
    setVolType('');
    setVolMin(''); setVolMax(''); setNumSteps('');
    setVolScale(''); setVolFreedom(''); setVolAlpha(''); setVolBeta('');
    setErrors([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const newErrors = [];
    if (!name.trim()) newErrors.push("Name is required");
    if (!amount || isNaN(Number(amount))) newErrors.push("Valid initial amount is required");
    if (!startMonth || isNaN(Number(startMonth))) newErrors.push("Start month is required");
    if (!volType) newErrors.push("Volatility Model is required");

    // Logic for Flat Mode
    let finalGrowth = growth;
    let finalIntervals: number | undefined = undefined;

    if (volType === 'flat') {
        const min = parseFloat(volMin);
        const max = parseFloat(volMax);
        const steps = parseInt(numSteps);
        
        if (isNaN(min) || isNaN(max) || isNaN(steps) || steps < 1) {
            newErrors.push("Min, Max, and Number of Steps are required for Flat volatility");
        } else {
            if (min >= max) newErrors.push("Min growth must be less than Max growth");
            
            const rawAvg = (min + max) / 2;
            // Clean Average Logic
            const cleanAvg = Math.abs(rawAvg) >= 1 ? rawAvg.toFixed(2) : parseFloat(rawAvg.toPrecision(3)).toString();
            
            finalGrowth = cleanAvg;
            finalIntervals = steps;
        }
    } else if (volType === 'nrig' || volType === 'student_t') {
        // Use explicitly entered growth rate
        if (!growth || isNaN(Number(growth))) {
            newErrors.push("Average Growth Rate is required");
        }
        finalGrowth = growth;
    }

    if (newErrors.length > 0) {
        setErrors(newErrors);
        return;
    }

    try {
        const payload = {
            plan_id: planId,
            expense_name: name,
            category,
            initial_amount: String(amount),
            growth_rate_percent: String(finalGrowth),
            start_month: Number(startMonth),
            end_month: endMonth ? Number(endMonth) : undefined,
            frequency: freq,
            pct_of_revenue: pctRevenue ? String(pctRevenue) : undefined,

            volatility_type: volType as any,
            vol_min: volType === 'flat' && volMin ? String(volMin) : undefined,
            vol_max: volType === 'flat' && volMax ? String(volMax) : undefined,
            vol_intervals: finalIntervals,
            
            // For advanced modes, growth is the mean
            vol_mean: (volType === 'nrig' || volType === 'student_t') ? String(finalGrowth) : undefined,
            vol_scale: (volType === 'nrig' || volType === 'student_t') && volScale ? String(volScale) : undefined,
            vol_freedom: volType === 'student_t' && volFreedom ? String(volFreedom) : undefined,
            vol_alpha: volType === 'nrig' && volAlpha ? String(volAlpha) : undefined,
            vol_beta: volType === 'nrig' && volBeta ? String(volBeta) : undefined,
        };

        if (itemToEdit) {
            await api.updateExpenseItem(itemToEdit.id, payload as any);
        } else {
            await api.createExpenseItem(payload as any);
        }

        clearForm();
        onSuccess();
    } catch (err) {
        console.error(err);
        setErrors(["Failed to save expense item. Please check your inputs."]);
    }
  };

  const getCalculatedAverage = () => {
      const min = parseFloat(volMin);
      const max = parseFloat(volMax);
      if (!isNaN(min) && !isNaN(max)) {
          const avg = (min + max) / 2;
          if (Math.abs(avg) >= 1) return avg.toFixed(2);
          return parseFloat(avg.toPrecision(3)).toString();
      }
      return '---';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-4 rounded border">
      <div className="flex justify-between items-center mb-1">
         <h3 className="font-bold text-gray-700">{itemToEdit ? 'Edit Expense' : 'Add Expense'}</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">* = Required Field. (Model uses Cash Basis accounting)</p>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative text-sm">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{errors.join(", ")}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500">Name *</label>
          <input className="w-full border p-2 rounded text-sm" placeholder="e.g. Salaries" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Category</label>
          <select className="w-full border p-2 rounded text-sm" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="opex">OpEx</option>
            <option value="capex">CapEx</option>
            <option value="payroll">Payroll</option>
            <option value="marketing">Marketing</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 flex items-center gap-1">
            Initial Amount ({currencySymbol}) *
            <Tooltip content="Initial amount of expense in Starting Month" />
          </label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
            <label className="text-xs text-gray-500 flex items-center gap-1">
              % of Revenue
              <Tooltip content="Percentage of revenue tied to expense." />
            </label>
            <input type="number" className="w-full border p-2 rounded text-sm" placeholder="Optional" value={pctRevenue} onChange={e => setPctRevenue(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500">Frequency</label>
          <select className="w-full border p-2 rounded text-sm" value={freq} onChange={e => setFreq(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="one_time">One-time</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Start Month *</label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={startMonth} onChange={e => setStartMonth(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">End Month</label>
          <input type="number" className="w-full border p-2 rounded text-sm" placeholder="Optional" value={endMonth} onChange={e => setEndMonth(e.target.value)} />
        </div>
      </div>

      {/* UNIFIED GROWTH & VOLATILITY SECTION */}
      <div className="border-t pt-4 mt-4">
        <h4 className="text-sm font-bold text-gray-700 mb-3">Growth & Volatility</h4>
        
        <div className="mb-4">
            <label className="text-xs text-gray-500">Volatility Model *</label>
            <select 
                className="w-full border p-2 rounded text-sm" 
                value={volType} 
                onChange={e => setVolType(e.target.value)}
            >
                <option value="" disabled>Select Volatility Model...</option>
                <option value="flat">Simple (Min/Max)</option>
                <option value="nrig">Comprehensive</option>
                <option value="student_t">Student's T</option>
            </select>
        </div>

        {/* BLOCK A: Simple (flat) */}
        {volType === 'flat' && (
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-gray-500">Minimum Growth (%)</label>
                    <input 
                        type="number" 
                        step="0.1" 
                        placeholder="negative = loss"
                        className="w-full border p-2 rounded text-sm" 
                        value={volMin} 
                        onChange={e => setVolMin(e.target.value)} 
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-500">Maximum Growth (%)</label>
                    <input 
                        type="number" 
                        step="0.1" 
                        className="w-full border p-2 rounded text-sm" 
                        value={volMax} 
                        onChange={e => setVolMax(e.target.value)} 
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-500">Number of Steps</label>
                    <input 
                        type="number" 
                        min="1" 
                        placeholder="e.g. 10"
                        step="1" 
                        className="w-full border p-2 rounded text-sm" 
                        value={numSteps} 
                        onChange={e => setNumSteps(e.target.value)} 
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-500">Average (Calculated)</label>
                    <input 
                        type="text" 
                        readOnly 
                        className="w-full border p-2 rounded text-sm bg-gray-100 text-gray-500 cursor-not-allowed" 
                        value={getCalculatedAverage()} 
                    />
                </div>
            </div>
        )}

        {/* BLOCK B: Advanced (nrig OR student_t) */}
        {(volType === 'nrig' || volType === 'student_t') && (
            <div className="space-y-4">
                <div>
                    <label className="text-xs text-gray-500 flex items-center gap-1">
                        Average Growth Rate (Mean)
                        <Tooltip content="The central tendency of the growth distribution." />
                    </label>
                    <input 
                        type="number" 
                        step="0.1" 
                        className="w-full border p-2 rounded text-sm" 
                        value={growth} 
                        onChange={e => setGrowth(e.target.value)} 
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-500">Scale (Volatility)</label>
                        <input type="number" step="0.01" className="w-full border p-2 rounded text-sm" value={volScale} onChange={e => setVolScale(e.target.value)} />
                    </div>
                    {volType === 'student_t' && (
                        <div>
                            <label className="text-xs text-gray-500">Degrees of Freedom</label>
                            <input type="number" step="0.1" className="w-full border p-2 rounded text-sm" value={volFreedom} onChange={e => setVolFreedom(e.target.value)} />
                        </div>
                    )}
                    {volType === 'nrig' && (
                        <>
                            <div>
                                <label className="text-xs text-gray-500">Alpha (Shape)</label>
                                <input type="number" step="0.01" className="w-full border p-2 rounded text-sm" value={volAlpha} onChange={e => setVolAlpha(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Beta (Skew)</label>
                                <input type="number" step="0.01" className="w-full border p-2 rounded text-sm" value={volBeta} onChange={e => setVolBeta(e.target.value)} />
                            </div>
                        </>
                    )}
                </div>
            </div>
        )}
      </div>

      <div className="flex gap-4">
        {itemToEdit && (
            <button 
                type="button" 
                onClick={onCancel} 
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded flex-1"
            >
                Cancel Edit
            </button>
        )}
        <button 
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded flex-1"
        >
            {itemToEdit ? 'Update Expense' : 'Add Expense'}
        </button>
      </div>
    </form>
  );
}
