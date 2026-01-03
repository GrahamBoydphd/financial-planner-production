'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Props {
  planId: string;
}

export default function CreditForm({ planId }: Props) {
  const [limit, setLimit] = useState('');
  const [rate, setRate] = useState('');

  useEffect(() => {
    let active = true;
    api.getCredit(planId).then(c => {
        if(!active) return;
        setLimit(c.facility_limit.toString());
        setRate(c.interest_rate.toString());
    }).catch(() => {});
    return () => { active = false; };
  }, [planId]);

  const handleSave = async () => {
    await api.upsertCredit({
        plan_id: planId,
        facility_limit: Number(limit),
        interest_rate: Number(rate),
        is_annual_rate: true // Defaulting to annual for simplicity
    });
    alert("Credit facility saved");
  };

  return (
    <div className="space-y-3 bg-gray-50 p-4 rounded border">
        <h3 className="font-bold text-gray-700 text-sm">Revolving Credit Facility</h3>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="text-xs text-gray-500">Max Limit ($)</label>
                <input type="number" className="w-full border p-1 rounded" value={limit} onChange={e => setLimit(e.target.value)} />
            </div>
            <div>
                <label className="text-xs text-gray-500">Interest Rate (%)</label>
                <input type="number" step="0.1" className="w-full border p-1 rounded" value={rate} onChange={e => setRate(e.target.value)} />
            </div>
        </div>
        <button onClick={handleSave} className="w-full bg-indigo-600 text-white py-1 rounded text-sm font-bold">Update Facility</button>
    </div>
  );
}
