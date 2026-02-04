'use client';

import { useState, useEffect } from 'react';
import { api, RevenueItem } from '@/lib/api';
import Tooltip from '@/components/ui/Tooltip';
import VolatilityInputs, { validateVolatilityParams, getVolatilityPayload } from '@/components/forms/shared/VolatilityInputs';

interface Props {
  planId: string;
  onSuccess: () => void;
  itemToEdit?: RevenueItem | null;
  onCancel?: () => void;
  currencySymbol?: string;
}

export default function RevenueForm({ planId, onSuccess, itemToEdit, onCancel, currencySymbol = '$' }: Props) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('sales');
  const [amount, setAmount] = useState('');
  const [growth, setGrowth] = useState('0');
  const [startMonth, setStartMonth] = useState('1');
  const [endMonth, setEndMonth] = useState('');
  const [freq, setFreq] = useState('monthly');
  const [cogsPercent, setCogsPercent] = useState('');

  // Volatility State
  const [volType, setVolType] = useState('none');
  const [volMin, setVolMin] = useState('');
  const [volMax, setVolMax] = useState('');
  const [numSteps, setNumSteps] = useState(''); // Changed from stepSize
  const [volScale, setVolScale] = useState('');
  const [volFreedom, setVolFreedom] = useState('');
  const [volAlpha, setVolAlpha] = useState('');
  const [volBeta, setVolBeta] = useState('');
  
  const [isAdvanced, setIsAdvanced] = useState(false);

  const [errors, setErrors] = useState<string[]>([]);

  // --- EFFECT: POPULATE FORM ON EDIT ---
  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.revenue_name);
      setSource(itemToEdit.source);
      setAmount(itemToEdit.initial_amount.toString());
      setGrowth(itemToEdit.growth_rate_percent.toString());
      setStartMonth(itemToEdit.start_month.toString());
      setEndMonth(itemToEdit.end_month ? itemToEdit.end_month.toString() : '');
      setFreq(itemToEdit.frequency);
      setCogsPercent(itemToEdit.cost_of_revenue_percent ? itemToEdit.cost_of_revenue_percent.toString() : '');
      
      // Map legacy 'none' or null to 'none'
      const vType = (itemToEdit.volatility_type && itemToEdit.volatility_type !== 'none') ? itemToEdit.volatility_type : 'none';
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
    setSource('sales');
    setAmount('');
    setGrowth('0');
    setStartMonth('1');
    setEndMonth('');
    setFreq('monthly');
    setCogsPercent('');
    setVolType('none');
    setVolMin(''); setVolMax(''); setNumSteps('');
    setVolScale(''); setVolFreedom(''); setVolAlpha(''); setVolBeta('');
    setIsAdvanced(false);
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
    const volErrors = validateVolatilityParams(volType, {
        min: volMin,
        max: volMax,
        intervals: numSteps,
        mean: growth,
        alpha: volAlpha,
        beta: volBeta,
        scale: volScale,
        freedom: volFreedom
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
            freedom: volFreedom
        });

        const payload = {
            plan_id: planId,
            revenue_name: name,
            source: source.toLowerCase(),
            initial_amount: String(amount),
            start_month: Number(startMonth),
            end_month: endMonth ? Number(endMonth) : undefined,
            frequency: freq.toLowerCase(),
            cost_of_revenue_percent: cogsPercent ? String(cogsPercent) : undefined,
            
            ...volPayload,
            volatility_type: volPayload.volatility_type as any
        };

        if (itemToEdit) {
            await api.updateRevenueItem(itemToEdit.id, payload as any);
        } else {
            await api.createRevenueItem(payload as any);
        }

        clearForm();
        onSuccess(); 
    } catch (err) {
        console.error(err);
        setErrors(["Failed to save revenue item. Please check your inputs."]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-4 rounded border">
      <div className="flex justify-between items-center mb-1">
         <h3 className="font-bold text-gray-700">{itemToEdit ? 'Edit Revenue Stream' : 'Add Revenue Stream'}</h3>
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
          <input className="w-full border p-2 rounded text-sm" placeholder="e.g. SaaS Subs" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Source Type</label>
          <select className="w-full border p-2 rounded text-sm" value={source} onChange={e => setSource(e.target.value)}>
            <option value="sales">Sales</option>
            <option value="subscription">Subscription</option>
            <option value="service">Service</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 flex items-center gap-1">
            Initial Amount ({currencySymbol}) *
            <Tooltip content="Initial amount of revenue in Starting Month" />
          </label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
            <label className="text-xs text-gray-500 flex items-center gap-1">
              Cost of Rev (%)
              <Tooltip content="Cost of revenue percentage." />
            </label>
            <input type="number" className="w-full border p-2 rounded text-sm" placeholder="Optional" value={cogsPercent} onChange={e => setCogsPercent(e.target.value)} />
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
        isAdvanced={isAdvanced}
        setIsAdvanced={setIsAdvanced}
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
            {itemToEdit ? 'Update Stream' : 'Add Stream'}
        </button>
      </div>
    </form>
  );
}
