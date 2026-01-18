'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import Tooltip from '@/components/ui/Tooltip';

interface Props {
  planId: string;
  onSuccess: () => void;
  currencySymbol?: string;
}

interface FormErrors {
  name?: string;
  amount?: string;
  month?: string;
}

export default function CapitalForm({ planId, onSuccess, currencySymbol = '$' }: Props) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors: FormErrors = {};
    if (!name.trim()) newErrors.name = 'Source Name is required';
    if (!amount) newErrors.amount = 'Amount is required';
    if (!month) newErrors.month = 'Month is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Clear errors and submit
    setErrors({});
    setIsSubmitting(true);
    
    try {
      // Force 2 decimal places for Rust strictness
      const formattedAmount = parseFloat(amount).toFixed(2);

      const payload = {
        plan_id: planId,
        injection_name: name,
        amount: formattedAmount,
        month: parseInt(month, 10)
      };

      console.log("Submitting Capital:", payload);

      await api.createCapitalInjection(payload);

      // Reset form on success
      setName('');
      setAmount('');
      setMonth('');
      onSuccess();
    } catch (error: any) {
      console.error("Failed to add capital injection", error);
      alert(JSON.stringify(error.response?.data || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-gray-800 text-sm">Add New Injection</h3>
        <span className="text-xs text-gray-400">Fixed Amount</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Name Input */}
        <div className="md:col-span-5">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Source Name <span className="text-red-500">*</span></label>
          <input 
            className={`w-full border p-2 rounded text-sm focus:ring-2 outline-none transition ${
              errors.name 
                ? 'border-red-500 focus:ring-red-200' 
                : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
            }`}
            placeholder="e.g. Seed Round, Founder Cash" 
            value={name} 
            onChange={e => {
              setName(e.target.value);
              if (errors.name) setErrors({ ...errors, name: undefined });
            }} 
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>

        {/* Amount Input */}
        <div className="md:col-span-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
            Amount ({currencySymbol}) <span className="text-red-500">*</span>
            <Tooltip content="Amount of capital injection." />
          </label>
          <input 
            type="number" 
            min="0"
            step="1000"
            className={`w-full border p-2 rounded text-sm focus:ring-2 outline-none transition ${
              errors.amount 
                ? 'border-red-500 focus:ring-red-200' 
                : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
            }`}
            placeholder="0.00" 
            value={amount} 
            onChange={e => {
              setAmount(e.target.value);
              if (errors.amount) setErrors({ ...errors, amount: undefined });
            }} 
          />
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
        </div>

        {/* Month Input */}
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
            Month <span className="text-red-500">*</span>
            <Tooltip content="Month in which capital is injected." />
          </label>
          <input 
            type="number" 
            min="1"
            max="120"
            className={`w-full border p-2 rounded text-sm focus:ring-2 outline-none transition ${
              errors.month 
                ? 'border-red-500 focus:ring-red-200' 
                : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
            }`}
            placeholder="1" 
            value={month} 
            onChange={e => {
              setMonth(e.target.value);
              if (errors.month) setErrors({ ...errors, month: undefined });
            }} 
          />
          {errors.month && <p className="text-red-500 text-xs mt-1">{errors.month}</p>}
        </div>
      </div>

      <button 
        disabled={isSubmitting}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-md text-sm font-bold transition-colors flex justify-center items-center gap-2"
      >
        {isSubmitting ? 'Adding...' : 'Add Capital Injection'}
      </button>
    </form>
  );
}
