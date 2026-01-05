'use client';

import { useState, useEffect } from 'react';
import { api, ExpenseItem } from '@/lib/api';
import VolatilityInputs from './shared/VolatilityInputs';

interface Props {
  planId: string;
  onSuccess: () => void;
  itemToEdit?: ExpenseItem | null;
  onCancel?: () => void;
}

export default function ExpenseForm({ planId, onSuccess, itemToEdit, onCancel }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('OpEx');
  const [amount, setAmount] = useState('');
  const [growth, setGrowth] = useState('0');
  const [startMonth, setStartMonth] = useState('1');
  const [endMonth, setEndMonth] = useState('');
  const [freq, setFreq] = useState('Monthly');
  const [pctRevenue, setPctRevenue] = useState('');

  // Volatility
  const [volType, setVolType] = useState('none');
  const [volMin, setVolMin] = useState('');
  const [volMax, setVolMax] = useState('');
  const [volIntervals, setVolIntervals] = useState('');
  const [volMean, setVolMean] = useState('');
  const [volScale, setVolScale] = useState('');
  const [volFreedom, setVolFreedom] = useState('');
  const [volAlpha, setVolAlpha] = useState('');
  const [volBeta, setVolBeta] = useState('');

  // UI State for Simple/Advanced Mode
  const [isAdvanced, setIsAdvanced] = useState(false);

  // --- POPULATE ON EDIT ---
  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.name);
      setCategory(itemToEdit.category);
      setAmount(itemToEdit.initial_amount.toString());
      setGrowth(itemToEdit.growth_rate_percent.toString());
      setStartMonth(itemToEdit.start_month.toString());
      setEndMonth(itemToEdit.end_month ? itemToEdit.end_month.toString() : '');
      setFreq(itemToEdit.frequency);
      setPctRevenue(itemToEdit.pct_of_revenue ? itemToEdit.pct_of_revenue.toString() : '');

      const vType = itemToEdit.volatility_type || 'none';
      setVolType(vType);
      setVolMin(itemToEdit.vol_min ? itemToEdit.vol_min.toString() : '');
      setVolMax(itemToEdit.vol_max ? itemToEdit.vol_max.toString() : '');
      setVolIntervals(itemToEdit.vol_intervals ? itemToEdit.vol_intervals.toString() : '');
      setVolMean(itemToEdit.vol_mean ? itemToEdit.vol_mean.toString() : '');
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
    setCategory('OpEx');
    setAmount('');
    setGrowth('0');
    setStartMonth('1');
    setEndMonth('');
    setFreq('Monthly');
    setPctRevenue('');
    setVolType('none');
    setVolMin(''); setVolMax(''); setVolIntervals('');
    setVolMean(''); setVolScale(''); setVolFreedom(''); setVolAlpha(''); setVolBeta('');
    setIsAdvanced(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount) return;

    const payload = {
      plan_id: planId,
      name,
      category,
      initial_amount: Number(amount),
      growth_rate_percent: Number(growth),
      start_month: Number(startMonth),
      end_month: endMonth ? Number(endMonth) : undefined,
      frequency: freq,
      pct_of_revenue: pctRevenue ? Number(pctRevenue) : undefined,

      volatility_type: volType !== 'none' ? volType as any : undefined,
      vol_min: volType === 'flat' && volMin ? Number(volMin) : undefined,
      vol_max: volType === 'flat' && volMax ? Number(volMax) : undefined,
      vol_intervals: volType === 'flat' && volIntervals ? Number(volIntervals) : undefined,
      vol_mean: volMean ? Number(volMean) : undefined,
      vol_scale: (volType === 'nrig' || volType === 'student_t') && volScale ? Number(volScale) : undefined,
      vol_freedom: volType === 'student_t' && volFreedom ? Number(volFreedom) : undefined,
      vol_alpha: volType === 'nrig' && volAlpha ? Number(volAlpha) : undefined,
      vol_beta: volType === 'nrig' && volBeta ? Number(volBeta) : undefined,
    };

    if (itemToEdit) {
        await api.updateExpenseItem(itemToEdit.id, payload);
    } else {
        await api.createExpenseItem(payload);
    }

    clearForm();
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-4 rounded border">
      <div className="flex justify-between items-center mb-2">
         <h3 className="font-bold text-gray-700">{itemToEdit ? 'Edit Expense' : 'Add Expense'}</h3>
         {itemToEdit && (
            <button type="button" onClick={onCancel} className="text-xs text-red-500 underline">Cancel Edit</button>
         )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500">Name</label>
          <input className="w-full border p-2 rounded text-sm" placeholder="e.g. Salaries" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Category</label>
          <select className="w-full border p-2 rounded text-sm" value={category} onChange={e => setCategory(e.target.value)}>
            <option>OpEx</option>
            <option>CapEx</option>
            <option>Payroll</option>
            <option>Marketing</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500">Initial Amount ($)</label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Growth Rate (%/mo)</label>
          <input type="number" step="0.1" className="w-full border p-2 rounded text-sm" value={growth} onChange={e => setGrowth(e.target.value)} />
        </div>
        <div>
            <label className="text-xs text-gray-500">% of Revenue</label>
            <input type="number" className="w-full border p-2 rounded text-sm" placeholder="Optional" value={pctRevenue} onChange={e => setPctRevenue(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500">Frequency</label>
          <select className="w-full border p-2 rounded text-sm" value={freq} onChange={e => setFreq(e.target.value)}>
            <option>Monthly</option>
            <option>One-time</option>
            <option>Quarterly</option>
            <option>Annually</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Start Month</label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={startMonth} onChange={e => setStartMonth(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">End Month (Opt)</label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={endMonth} onChange={e => setEndMonth(e.target.value)} />
        </div>
      </div>

      {/* SHARED VOLATILITY COMPONENT */}
      <VolatilityInputs 
        volType={volType} setVolType={setVolType}
        volMean={volMean} setVolMean={setVolMean}
        volMin={volMin} setVolMin={setVolMin}
        volMax={volMax} setVolMax={setVolMax}
        volIntervals={volIntervals} setVolIntervals={setVolIntervals}
        volScale={volScale} setVolScale={setVolScale}
        volFreedom={volFreedom} setVolFreedom={setVolFreedom}
        volAlpha={volAlpha} setVolAlpha={setVolAlpha}
        volBeta={volBeta} setVolBeta={setVolBeta}
        isAdvanced={isAdvanced} setIsAdvanced={setIsAdvanced}
      />

      <button className={`w-full text-white p-2 rounded font-bold ${itemToEdit ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-600 hover:bg-red-700'}`}>
        {itemToEdit ? 'Update Expense' : 'Add Expense'}
      </button>
    </form>
  );
}
