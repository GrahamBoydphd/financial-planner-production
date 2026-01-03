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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount || !month) return;
    
    await api.createCapitalInjection({
        plan_id: planId,
        name,
        amount: Number(amount),
        month: Number(month)
    });
    
    setName('');
    setAmount('');
    setMonth('');
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 bg-gray-50 p-4 rounded border">
        <h3 className="font-bold text-gray-700 text-sm">Add Injection</h3>
        <div className="grid grid-cols-3 gap-2">
            <input className="border p-1 rounded text-sm" placeholder="Name (e.g. Seed)" value={name} onChange={e => setName(e.target.value)} />
            <input type="number" className="border p-1 rounded text-sm" placeholder="Amount ($)" value={amount} onChange={e => setAmount(e.target.value)} />
            <input type="number" className="border p-1 rounded text-sm" placeholder="Month" value={month} onChange={e => setMonth(e.target.value)} />
        </div>
        <button className="w-full bg-green-600 text-white py-1 rounded text-sm font-bold">Add Capital</button>
    </form>
  );
}
