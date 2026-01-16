'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import Tooltip from '@/components/ui/Tooltip';

interface Props {
  planId: string;
}

interface FormErrors {
  threshold?: string;
  ratio?: string;
}

interface SavedPolicy {
  enabled: boolean;
  threshold: string;
  ratio: string;
}

export default function DividendForm({ planId }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState('');
  const [ratio, setRatio] = useState(''); // Stored as 0-100 string
  const [errors, setErrors] = useState<FormErrors>({});
  const [savedPolicy, setSavedPolicy] = useState<SavedPolicy | null>(null);

  useEffect(() => {
    let active = true;
    api.getDividends(planId).then(d => {
        if(!active) return;
        setEnabled(d.is_enabled);
        setThreshold(d.safety_threshold.toString());
        // Convert 0-1 ratio to 0-100 percentage
        const ratioPct = (Number(d.payout_ratio) * 100).toString();
        setRatio(ratioPct);
        setSavedPolicy({ enabled: d.is_enabled, threshold: d.safety_threshold.toString(), ratio: ratioPct });
    }).catch(() => {});
    return () => { active = false; };
  }, [planId]);

  const handleSave = async () => {
    const newErrors: FormErrors = {};
    if (enabled) {
        if (!threshold) newErrors.threshold = "Threshold is required";
        if (!ratio) newErrors.ratio = "Payout ratio is required";
    }

    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
    }
    setErrors({});

    try {
        // Convert 0-100 percentage to 0-1 ratio string
        const ratioVal = parseFloat(ratio);
        const ratioDecimal = (ratioVal / 100).toString();

        await api.upsertDividends({
            plan_id: planId,
            is_enabled: enabled,
            safety_threshold: threshold, // Send as string
            payout_ratio: ratioDecimal   // Send as string
        });
        setSavedPolicy({ enabled, threshold, ratio });
        alert("Dividend policy saved");
    } catch (e) {
        console.error(e);
        alert("Failed to save dividend policy");
    }
  };

  return (
    <div className="space-y-4 bg-gray-50 p-4 rounded border">
        <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-700 text-sm">Dividend Policy</h3>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
                Enable Dividends
            </label>
        </div>

        {enabled && (
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-gray-500 font-medium flex items-center gap-1">
                        Safety Threshold ($) <span className="text-red-500">*</span>
                        <Tooltip content="Minimum cash balance required before dividends are paid." />
                    </label>
                    <input
                        type="number"
                        className={`w-full border p-1 rounded ${errors.threshold ? 'border-red-500' : 'border-gray-300'}`}
                        value={threshold}
                        onChange={e => setThreshold(e.target.value)}
                    />
                    {errors.threshold && <p className="text-red-500 text-[10px] mt-1">{errors.threshold}</p>}
                </div>
                <div>
                    <label className="text-xs text-gray-500 flex items-center gap-1 font-medium">
                        Payout Percentage (0-100) <span className="text-red-500">*</span>
                        <Tooltip content="Percentage of surplus cash distributed as dividends (0-100)." />
                    </label>
                    <input
                        type="number"
                        step="0.1"
                        className={`w-full border p-1 rounded ${errors.ratio ? 'border-red-500' : 'border-gray-300'}`}
                        value={ratio}
                        onChange={e => setRatio(e.target.value)}
                    />
                    {errors.ratio && <p className="text-red-500 text-[10px] mt-1">{errors.ratio}</p>}
                </div>
            </div>
        )}

        {/* Summary Card */}
        {savedPolicy && (
            <div className={`p-3 rounded border shadow-sm text-xs ${savedPolicy.enabled ? 'bg-blue-50 border-blue-100' : 'bg-gray-100 border-gray-200'}`}>
                <h4 className={`font-semibold mb-1 ${savedPolicy.enabled ? 'text-blue-900' : 'text-gray-500'}`}>
                    Status: {savedPolicy.enabled ? 'Active' : 'Disabled'}
                </h4>
                {savedPolicy.enabled && (
                    <div className="text-gray-700">
                        Payout <span className="font-bold">{savedPolicy.ratio}%</span> of surplus above <span className="font-bold">${Number(savedPolicy.threshold).toLocaleString()}</span>.
                    </div>
                )}
            </div>
        )}

        <button onClick={handleSave} className="w-full bg-blue-600 text-white py-1 rounded text-sm font-bold hover:bg-blue-700 transition-colors">Update Policy</button>
    </div>
  );
}
