'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  planId: string;
  onSuccess: () => void;
}

export default function CapitalForm({ planId, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount || !month) return;

    setIsSubmitting(true);
    try {
      await api.createCapitalInjection({
        plan_id: planId, // Ensure snake_case if your backend expects it
        name,
        amount: Number(amount),
        month: Number(month)
      });

      // Reset form on success
      setName('');
      setAmount('');
      setMonth('');
      onSuccess();
    } catch (error) {
      console.error("Failed to add capital injection", error);
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
          <label className="block text-xs font-semibold text-gray-600 mb-1">Source Name</label>
          <input 
            className="w-full border border-gray-300 p-2 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition" 
            placeholder="e.g. Seed Round, Founder Cash" 
            value={name} 
            onChange={e => setName(e.target.value)} 
          />
        </div>

        {/* Amount Input */}
        <div className="md:col-span-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Amount ($)</label>
          <input 
            type="number" 
            min="0"
            step="1000"
            className="w-full border border-gray-300 p-2 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition" 
            placeholder="0.00" 
            value={amount} 
            onChange={e => setAmount(e.target.value)} 
          />
        </div>

        {/* Month Input */}
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Month</label>
          <input 
            type="number" 
            min="1"
            max="120"
            className="w-full border border-gray-300 p-2 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition" 
            placeholder="1" 
            value={month} 
            onChange={e => setMonth(e.target.value)} 
          />
        </div>
      </div>

      <button 
        disabled={isSubmitting || !name || !amount}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-md text-sm font-bold transition-colors flex justify-center items-center gap-2"
      >
        {isSubmitting ? 'Adding...' : 'Add Capital Injection'}
      </button>
    </form>
  );
}
