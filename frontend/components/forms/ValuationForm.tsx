'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  planId: string;
  onSuccess: () => void;
}

export default function ValuationForm({ planId, onSuccess }: Props) {
  const [method, setMethod] = useState<'revenue' | 'ebitda'>('revenue');
  const [revenueMultiple, setRevenueMultiple] = useState('');
  const [ebitdaMultiple, setEbitdaMultiple] = useState('');

  const handleSave = async () => {
    if (method === 'revenue' && !revenueMultiple) return;
    if (method === 'ebitda' && !ebitdaMultiple) return;

    await api.createValuation({
        plan_id: planId,
        name: 'Valuation',
        method: method,
        multiplier: method === 'revenue' ? Number(revenueMultiple) : Number(ebitdaMultiple),
        date_applied: new Date().toISOString().split('T')[0]
    });
    
    setRevenueMultiple('');
    setEbitdaMultiple('');
    onSuccess();
  };

  return (
    <div className="space-y-3 bg-gray-50 p-4 rounded border">
        <h3 className="font-bold text-gray-700 text-sm">Exit Valuation Model</h3>
        
        <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-1 cursor-pointer">
                <input 
                    type="radio" 
                    name="valMethod" 
                    checked={method === 'revenue'} 
                    onChange={() => setMethod('revenue')} 
                />
                Revenue Multiple
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
                <input 
                    type="radio" 
                    name="valMethod" 
                    checked={method === 'ebitda'} 
                    onChange={() => setMethod('ebitda')} 
                />
                EBITDA Multiple
            </label>
        </div>

        <div className="grid grid-cols-1 gap-4">
            {method === 'revenue' && (
                <div>
                    <label className="text-xs text-gray-500">Revenue Multiple (x)</label>
                    <input 
                        type="number" 
                        step="0.1" 
                        className="w-full border p-1 rounded" 
                        value={revenueMultiple} 
                        onChange={e => setRevenueMultiple(e.target.value)} 
                        placeholder="e.g. 5.0"
                    />
                </div>
            )}
            {method === 'ebitda' && (
                <div>
                    <label className="text-xs text-gray-500">EBITDA Multiple (x)</label>
                    <input 
                        type="number" 
                        step="0.1" 
                        className="w-full border p-1 rounded" 
                        value={ebitdaMultiple} 
                        onChange={e => setEbitdaMultiple(e.target.value)} 
                        placeholder="e.g. 12.0"
                    />
                </div>
            )}
        </div>
        <button onClick={handleSave} className="w-full bg-purple-600 text-white py-1 rounded text-sm font-bold">Add Valuation Logic</button>
    </div>
  );
}
