'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import Tooltip from '@/components/ui/Tooltip';

interface Props {
  planId: string;
  onSuccess: () => void;
}

interface FormErrors {
  multiple?: string;
  general?: string;
}

export default function ValuationForm({ planId, onSuccess }: Props) {
  const [method, setMethod] = useState<'revenue' | 'ebitda'>('revenue');
  const [revenueMultiple, setRevenueMultiple] = useState('');
  const [ebitdaMultiple, setEbitdaMultiple] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [activeValuation, setActiveValuation] = useState<any>(null);

  useEffect(() => {
    let active = true;
    api.getValuation(planId).then(data => {
        if (!active) return;
        console.log("DEBUG VALUATION FETCH:", data);

        // Check if data is an array and has items
        if (Array.isArray(data) && data.length > 0) {
            // Take the LAST item (assuming chronological order)
            const lastItem = data[data.length - 1];
            
            setActiveValuation(lastItem);
            setMethod(lastItem.method);
            
            if (lastItem.method === 'revenue') {
                setRevenueMultiple(lastItem.multiplier.toString());
                setEbitdaMultiple('');
            } else {
                setEbitdaMultiple(lastItem.multiplier.toString());
                setRevenueMultiple('');
            }
        }
    }).catch((error) => {
        console.error("DEBUG VALUATION ERROR:", error);
    });
    return () => { active = false; };
  }, [planId]);

  const handleSave = async () => {
    setErrors({});
    
    // Validation
    if (method === 'revenue' && !revenueMultiple) {
        setErrors({ multiple: "Revenue multiple is required." });
        return;
    }
    if (method === 'ebitda' && !ebitdaMultiple) {
        setErrors({ multiple: "EBITDA multiple is required." });
        return;
    }

    try {
        const payload = {
            plan_id: planId,
            name: 'Valuation',
            method: method,
            multiplier: method === 'revenue' ? revenueMultiple : ebitdaMultiple,
            date_applied: new Date().toISOString().split('T')[0]
        };
        await api.createValuation(payload);
        
        setActiveValuation(payload);
        onSuccess();
    } catch (e) {
        setErrors({ general: "Failed to save valuation logic." });
    }
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
                    <label className="text-xs text-gray-500 flex items-center gap-1">
                        Revenue Multiple (x)
                        <Tooltip content="Multiple applied to revenue for valuation." />
                    </label>
                    <input 
                        type="number" 
                        step="0.1" 
                        className={`w-full border p-1 rounded ${errors.multiple ? 'border-red-500' : ''}`} 
                        value={revenueMultiple} 
                        onChange={e => {
                            setRevenueMultiple(e.target.value);
                            if (errors.multiple) setErrors({});
                        }} 
                        placeholder="e.g. 5.0"
                    />
                    {errors.multiple && <p className="text-red-500 text-xs mt-1">{errors.multiple}</p>}
                </div>
            )}
            {method === 'ebitda' && (
                <div>
                    <label className="text-xs text-gray-500 flex items-center gap-1">
                        EBITDA Multiple (x)
                        <Tooltip content="Multiple applied to EBITDA for valuation." />
                    </label>
                    <input 
                        type="number" 
                        step="0.1" 
                        className={`w-full border p-1 rounded ${errors.multiple ? 'border-red-500' : ''}`} 
                        value={ebitdaMultiple} 
                        onChange={e => {
                            setEbitdaMultiple(e.target.value);
                            if (errors.multiple) setErrors({});
                        }} 
                        placeholder="e.g. 12.0"
                    />
                    {errors.multiple && <p className="text-red-500 text-xs mt-1">{errors.multiple}</p>}
                </div>
            )}
        </div>

        {errors.general && <div className="text-red-600 text-xs font-semibold">{errors.general}</div>}

        {/* Summary Card */}
        {activeValuation && (
            <div className="mt-4 p-3 bg-white rounded border border-gray-200 text-xs shadow-sm">
                <h4 className="font-bold text-gray-700 mb-1">Current Model: {activeValuation.method === 'revenue' ? 'Revenue Multiple' : 'EBITDA Multiple'} ({activeValuation.multiplier}x)</h4>
                <div className="flex justify-between items-center">
                    <span className="text-gray-600">Method:</span>
                    <span className="font-mono font-semibold text-purple-700">
                        {activeValuation.method === 'revenue' ? 'Revenue Multiple' : 'EBITDA Multiple'}
                    </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                    <span className="text-gray-600">Multiplier:</span>
                    <span className="font-mono font-semibold text-purple-700">
                        {activeValuation.multiplier}x
                    </span>
                </div>
            </div>
        )}

        <button onClick={handleSave} className="w-full bg-purple-600 text-white py-1 rounded text-sm font-bold">
            {activeValuation ? 'Update Valuation Logic' : 'Set Valuation Logic'}
        </button>
    </div>
  );
}
