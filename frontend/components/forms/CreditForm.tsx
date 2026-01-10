'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Props {
  planId: string;
}

interface FormErrors {
  limit?: string;
  rate?: string;
}

interface SavedConfig {
  limit: string;
  rate: string;
  isAnnual: boolean;
}

export default function CreditForm({ planId }: Props) {
  const [limit, setLimit] = useState('');
  const [rate, setRate] = useState('');
  const [isAnnual, setIsAnnual] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [savedConfig, setSavedConfig] = useState<SavedConfig | null>(null);

  useEffect(() => {
    let active = true;
    api.getCredit(planId).then(c => {
        if(!active) return;
        const l = c.facility_limit.toString();
        const r = c.interest_rate.toString();
        const ann = c.is_annual_rate !== undefined ? c.is_annual_rate : true;
        
        setLimit(l);
        setRate(r);
        setIsAnnual(ann);
        setSavedConfig({ limit: l, rate: r, isAnnual: ann });
    }).catch(() => {});
    return () => { active = false; };
  }, [planId]);

  const handleSave = async () => {
    // Validation
    const newErrors: FormErrors = {};
    if (!limit) newErrors.limit = 'Limit is required';
    if (!rate) newErrors.rate = 'Rate is required';

    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
    }
    setErrors({});

    try {
        await api.upsertCredit({
            plan_id: planId,
            facility_limit: limit, // Send as string
            interest_rate: rate,   // Send as string
            is_annual_rate: isAnnual
        });
        setSavedConfig({ limit, rate, isAnnual });
        alert("Credit facility saved");
    } catch (e) {
        console.error(e);
        alert("Failed to save credit facility");
    }
  };

  return (
    <div className="space-y-4 bg-gray-50 p-4 rounded border">
        <h3 className="font-bold text-gray-700 text-sm">Revolving Credit Facility</h3>
        
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="text-xs text-gray-500 font-medium">Max Limit ($) <span className="text-red-500">*</span></label>
                <input 
                    type="number" 
                    className={`w-full border p-1 rounded ${errors.limit ? 'border-red-500' : 'border-gray-300'}`}
                    value={limit} 
                    onChange={e => setLimit(e.target.value)} 
                />
                {errors.limit && <p className="text-red-500 text-[10px] mt-1">{errors.limit}</p>}
            </div>
            <div>
                <label className="text-xs text-gray-500 font-medium">Interest Rate (%) <span className="text-red-500">*</span></label>
                <input 
                    type="number" 
                    step="0.1" 
                    className={`w-full border p-1 rounded ${errors.rate ? 'border-red-500' : 'border-gray-300'}`}
                    value={rate} 
                    onChange={e => setRate(e.target.value)} 
                />
                {errors.rate && <p className="text-red-500 text-[10px] mt-1">{errors.rate}</p>}
            </div>
        </div>
        
        <div className="flex items-center gap-4 text-xs text-gray-600">
            <span className="font-semibold">Rate Type:</span>
            <label className="flex items-center gap-1 cursor-pointer">
                <input 
                    type="radio" 
                    name="rateType" 
                    checked={isAnnual} 
                    onChange={() => setIsAnnual(true)} 
                />
                Annual (APR)
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
                <input 
                    type="radio" 
                    name="rateType" 
                    checked={!isAnnual} 
                    onChange={() => setIsAnnual(false)} 
                />
                Monthly
            </label>
        </div>

        {/* Summary Card */}
        {savedConfig && (
            <div className="bg-white p-3 rounded border border-indigo-100 shadow-sm text-xs mt-2">
                <h4 className="font-semibold text-indigo-900 mb-1">Active Facility Settings</h4>
                <div className="flex justify-between text-gray-600">
                    <span>Limit: <span className="font-mono text-gray-900 font-bold">${Number(savedConfig.limit).toLocaleString()}</span></span>
                    <span>Rate: <span className="font-mono text-gray-900 font-bold">{savedConfig.rate}%</span> {savedConfig.isAnnual ? '(APR)' : '(Monthly)'}</span>
                </div>
            </div>
        )}

        <button onClick={handleSave} className="w-full bg-indigo-600 text-white py-1 rounded text-sm font-bold hover:bg-indigo-700 transition-colors">Update Facility</button>
    </div>
  );
}
