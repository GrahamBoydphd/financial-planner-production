'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import Tooltip from '@/components/ui/Tooltip';

interface Props {
  planId: string;
}

export default function DividendForm({ planId }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState('');
  const [ratio, setRatio] = useState(''); // Stored as 0-100 string

  useEffect(() => {
    let active = true;
    api.getDividends(planId).then(d => {
        if(!active) return;
        setEnabled(d.is_enabled);
        setThreshold(d.safety_threshold.toString());
        // Convert 0-1 ratio to 0-100 percentage
        setRatio((d.payout_ratio * 100).toString());
    }).catch(() => {});
    return () => { active = false; };
  }, [planId]);

  const handleSave = async () => {
    await api.upsertDividends({
        plan_id: planId,
        is_enabled: enabled,
        safety_threshold: Number(threshold),
        // Convert 0-100 percentage to 0-1 ratio
        payout_ratio: Number(ratio) / 100
    });
    alert("Dividend policy saved");
  };

  return (
    <div className="space-y-3 bg-gray-50 p-4 rounded border">
        <div className="flex justify-between">
            <h3 className="font-bold text-gray-700 text-sm">Dividend Policy</h3>
            <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
                Enable Dividends
            </label>
        </div>
        {enabled && (
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-gray-500">Safety Threshold ($)</label>
                    <input type="number" className="w-full border p-1 rounded" value={threshold} onChange={e => setThreshold(e.target.value)} />
                </div>
                <div>
                    <label className="text-xs text-gray-500 flex items-center gap-1">
                        Payout Percentage (0-100)
                        <Tooltip content="% of surplus cash distributed." />
                    </label>
                    <input type="number" step="0.1" className="w-full border p-1 rounded" value={ratio} onChange={e => setRatio(e.target.value)} />
                </div>
            </div>
        )}
        <button onClick={handleSave} className="w-full bg-blue-600 text-white py-1 rounded text-sm font-bold">Update Policy</button>
    </div>
  );
}
