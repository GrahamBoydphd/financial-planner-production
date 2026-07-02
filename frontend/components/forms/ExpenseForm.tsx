'use client';

import { useState, useEffect } from 'react';
import { api, ExpenseItem } from '@/lib/api';
import Tooltip from '@/components/ui/Tooltip';
import VolatilityInputs, { VolatilityConfig } from '@/components/forms/shared/VolatilityInputs';

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
  const [startMonth, setStartMonth] = useState('1');
  const [endMonth, setEndMonth] = useState('');
  const [freq, setFreq] = useState('monthly');
  const [pctRevenue, setPctRevenue] = useState('');

  // Volatility Configs State
  const [volatilityConfigs, setVolatilityConfigs] = useState<VolatilityConfig[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // --- POPULATE ON EDIT ---
  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.expense_name);
      setCategory(itemToEdit.category);
      setAmount(itemToEdit.initial_amount.toString());
      setStartMonth(itemToEdit.start_month.toString());
      setEndMonth(itemToEdit.end_month ? itemToEdit.end_month.toString() : '');
      setFreq(itemToEdit.frequency);
      setPctRevenue(itemToEdit.pct_of_revenue ? itemToEdit.pct_of_revenue.toString() : '');
      
      const configs = (itemToEdit as any)?.volatility_configs || [];
      setVolatilityConfigs(configs);
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
    setVolatilityConfigs([]);
    setErrors([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const newErrors = [];
    if (!name.trim()) newErrors.push("Name is required");
    if (!amount || isNaN(Number(amount))) newErrors.push("Valid initial amount is required");
    if (!startMonth || isNaN(Number(startMonth))) newErrors.push("Start month is required");

    // Strict validation guardrail: cannot submit with empty volatility configs
    if (!volatilityConfigs || volatilityConfigs.length === 0) {
        newErrors.push("Validation Error: The simulation engine requires a financial stream to have an active variance profile. Please enable at least one volatility force (Compounding Growth and/or Transient Operational Noise) before saving this item.");
    }

    if (volatilityConfigs.some(c => !c.volatility_type)) {
        newErrors.push("Please select a distribution type for all enabled volatility models.");
    }

    if (newErrors.length > 0) {
        setErrors(newErrors);
        return;
    }

    try {
        const compGrowth = volatilityConfigs.find(c => c.mode_name === 'compounding_growth');
        let rootGrowth = '0.0';
        if (compGrowth) {
            if (compGrowth.volatility_type === 'flat' && compGrowth.vol_min && compGrowth.vol_max) {
                rootGrowth = ((parseFloat(compGrowth.vol_min) + parseFloat(compGrowth.vol_max)) / 2).toString();
            } else if (compGrowth.target_mean) {
                rootGrowth = String(compGrowth.target_mean);
            }
        }

        const cleanConfigs = volatilityConfigs.map(c => {
            const cleaned: any = { ...c };
            Object.keys(cleaned).forEach(key => {
                if (cleaned[key] === '') {
                    cleaned[key] = null;
                }
            });
            return cleaned;
        });

        const payload = {
            plan_id: planId,
            expense_name: name,
            category,
            initial_amount: String(amount),
            growth_rate_percent: rootGrowth,
            start_month: Number(startMonth),
            end_month: endMonth ? Number(endMonth) : undefined,
            frequency: freq,
            pct_of_revenue: pctRevenue ? String(pctRevenue) : undefined,
            volatility_configs: cleanConfigs
        };

        if (itemToEdit) {
            await api.updateExpenseItem(itemToEdit.id, payload as any);
        } else {
            await api.createExpenseItem(payload as any);
        }

        clearForm();
        onSuccess();
    } catch (err: any) {
        console.error(err);
        const status = err.response?.status;
        const errMsg = err.response?.data?.message || err.message || '';
        if (status === 400) {
            setErrors([errMsg || "Validation Error: Please check your inputs. Ensure all required distribution fields are valid."]);
        } else {
            setErrors([errMsg || "Failed to save item. Please check your inputs."]);
        }
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
      <VolatilityInputs configs={volatilityConfigs} onChange={setVolatilityConfigs} />

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
