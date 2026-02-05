'use client';

import { useState, useEffect } from 'react';
import { api, ExpenseItem } from '@/lib/api';
import Tooltip from '@/components/ui/Tooltip';
import VolatilityInputs, { validateVolatilityParams, getVolatilityPayload, getVolatilityUIState } from '@/components/forms/shared/VolatilityInputs';

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
  const [volType, setVolType] = useState('none');
  const [volMode, setVolMode] = useState<'simple' | 'advanced'>('simple');

  // Advanced Params
  const [volMin, setVolMin] = useState('');
  const [volMax, setVolMax] = useState('');
  const [numSteps, setNumSteps] = useState(''); 
  const [volScale, setVolScale] = useState('');
  const [volFreedom, setVolFreedom] = useState('');
  const [volAlpha, setVolAlpha] = useState('');
  const [volBeta, setVolBeta] = useState('');

  // Simple Params
  const [volFatness, setVolFatness] = useState('');
  const [volSkew, setVolSkew] = useState('');
  const [volWidth, setVolWidth] = useState('');

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

      // Use centralized helper
      const ui = getVolatilityUIState(itemToEdit);
      setVolType(ui.volType);
      setVolMode(ui.volMode);
      setGrowth(ui.volMean);
      setVolMin(ui.volMin);
      setVolMax(ui.volMax);
      setNumSteps(ui.volIntervals);
      setVolScale(ui.volScale);
      setVolFreedom(ui.volFreedom);
      setVolAlpha(ui.volAlpha);
      setVolBeta(ui.volBeta);
      setVolFatness(ui.volFatness);
      setVolSkew(ui.volSkew);
      setVolWidth(ui.volWidth);
    } else {
      clearForm();
    }
  }, [itemToEdit]);

  const clearForm = () => {
    setName('');
    setCategory('opex');
    setAmount('');
    setStartMonth('1');
    setEndMonth('');
    setFreq('monthly');
    setPctRevenue('');
    
    const defaults = getVolatilityUIState(null);
    setVolType(defaults.volType);
    setVolMode(defaults.volMode);
    setGrowth(defaults.volMean);
    setVolMin(defaults.volMin);
    setVolMax(defaults.volMax);
    setNumSteps(defaults.volIntervals);
    setVolScale(defaults.volScale);
    setVolFreedom(defaults.volFreedom);
    setVolAlpha(defaults.volAlpha);
    setVolBeta(defaults.volBeta);
    setVolFatness(defaults.volFatness);
    setVolSkew(defaults.volSkew);
    setVolWidth(defaults.volWidth);

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

    // Centralized Volatility Validation
    const volErrors = validateVolatilityParams(volType, volMode, {
        min: volMin,
        max: volMax,
        intervals: numSteps,
        mean: growth,
        alpha: volAlpha,
        beta: volBeta,
        scale: volScale,
        freedom: volFreedom,
        fatness: volFatness,
        skew: volSkew,
        width: volWidth
    });
    newErrors.push(...volErrors);

    if (newErrors.length > 0) {
        setErrors(newErrors);
        return;
    }

    try {
        // Use centralized helper to construct volatility payload
        const volPayload = getVolatilityPayload(volType, {
            min: volMin,
            max: volMax,
            intervals: numSteps,
            mean: growth,
            alpha: volAlpha,
            beta: volBeta,
            scale: volScale,
            freedom: volFreedom,
            fatness: volFatness,
            skew: volSkew,
            width: volWidth
        }, volMode);

        const payload = {
            plan_id: planId,
            expense_name: name,
            category,
            initial_amount: String(amount),
            start_month: Number(startMonth),
            end_month: endMonth ? Number(endMonth) : undefined,
            frequency: freq,
            pct_of_revenue: pctRevenue ? String(pctRevenue) : undefined,

            ...volPayload,
            volatility_type: volPayload.volatility_type as any
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
      <VolatilityInputs
        volType={volType}
        setVolType={setVolType}
        volMean={growth}
        setVolMean={setGrowth}
        volMin={volMin}
        setVolMin={setVolMin}
        volMax={volMax}
        setVolMax={setVolMax}
        volIntervals={numSteps}
        setVolIntervals={setNumSteps}
        volScale={volScale}
        setVolScale={setVolScale}
        volFreedom={volFreedom}
        setVolFreedom={setVolFreedom}
        volAlpha={volAlpha}
        setVolAlpha={setVolAlpha}
        volBeta={volBeta}
        setVolBeta={setVolBeta}
        volMode={volMode}
        setVolMode={setVolMode}
        volFatness={volFatness}
        setVolFatness={setVolFatness}
        volSkew={volSkew}
        setVolSkew={setVolSkew}
        volWidth={volWidth}
        setVolWidth={setVolWidth}
        meanLabel="Average Growth Rate (Mean)"
        alwaysShowMean={volType !== "flat"}
      />

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
