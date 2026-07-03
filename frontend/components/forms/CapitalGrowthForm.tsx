'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { getVolatilityPayload, validateVolatilityParams, getVolatilityUIState } from '@/components/forms/shared/VolatilityInputs';

interface Props {
  planId: string;
  onSuccess: () => void;
}

interface FormErrors {
  volMean?: string;
  volMin?: string;
  volMax?: string;
  volIntervals?: string;
  volAlpha?: string;
  volBeta?: string;
  volScale?: string;
  volFreedom?: string;
  general?: string;
}

export default function CapitalGrowthForm({ planId, onSuccess }: Props) {
  const [volType, setVolType] = useState('none');
  const [volMode, setVolMode] = useState<'simple' | 'advanced'>('simple');
  
  // Flat / Student-T / NRIG Params
  const [mean, setMean] = useState('');     // Mean / Mu / Growth Rate
  const [volMin, setVolMin] = useState(''); // Min
  const [volMax, setVolMax] = useState(''); // Max
  const [volIntervals, setVolIntervals] = useState('');
  
  // Specific NRIG / Student-T Params
  const [alpha, setAlpha] = useState('');
  const [beta, setBeta] = useState('');
  const [scale, setScale] = useState(''); // Delta / Scale
  const [freedom, setFreedom] = useState('');

  // Simple Params
  const [volFatness, setVolFatness] = useState('');
  const [volSkew, setVolSkew] = useState('');
  const [volWidth, setVolWidth] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  
  // Active Strategy (Saved in DB)
  const [savedConfig, setSavedConfig] = useState<any>(null);

  useEffect(() => {
    let active = true;
    api.getCapitalGrowth(planId).then(p => {
      if (!active) return;
      setSavedConfig(p); // Store initial fetched config as "Active"

      const ui = getVolatilityUIState(p);
      setVolType(ui.volType);
      setVolMode(ui.volMode);
      setMean(ui.volMean);
      setVolMin(ui.volMin);
      setVolMax(ui.volMax);
      setVolIntervals(ui.volIntervals);
      setScale(ui.volScale);
      setFreedom(ui.volFreedom);
      setAlpha(ui.volAlpha);
      setBeta(ui.volBeta);
      setVolFatness(ui.volFatness);
      setVolSkew(ui.volSkew);
      setVolWidth(ui.volWidth);
    }).catch(() => {});
    return () => { active = false; };
  }, [planId]);

  const handleSave = async () => {
    setErrors({});

    // Use shared validation logic
    const volErrors = validateVolatilityParams(volType, volMode, {
        min: volMin,
        max: volMax,
        intervals: volIntervals,
        mean: mean,
        alpha: alpha,
        beta: beta,
        scale: scale,
        freedom: freedom,
        fatness: volFatness,
        skew: volSkew,
        width: volWidth
    });

    if (volErrors.length > 0) {
        setErrors({ general: volErrors.join(" ") });
        return;
    }

    try {
        // Use centralized helper to construct volatility payload
        const volPayload = getVolatilityPayload(volType.toLowerCase(), {
            min: volMin,
            max: volMax,
            intervals: volIntervals,
            mean: mean,
            alpha: alpha,
            beta: beta,
            scale: scale,
            freedom: freedom,
            fatness: volFatness,
            skew: volSkew,
            width: volWidth
        }, volMode);

        const payload = {
            plan_id: planId,
            ...volPayload,
            volatility_type: volPayload.volatility_type as any
        };

        await api.upsertCapitalGrowth(payload);
        setSavedConfig(payload); // Update active strategy
        onSuccess();
    } catch (err) {
        setErrors({ general: "Failed to save configuration." });
    }
  };

  // Render Summary Card Content
  const renderActiveStrategy = () => {
    if (!savedConfig) return "Loading...";
    const type = (savedConfig.volatility_type || 'none').toLowerCase();
    
    if (type === 'none') return "Standard (No Volatility)";

    // Handle rename in display
    const valMean = savedConfig.growth_rate_percent ?? savedConfig.vol_mean;
    let details = `Mean: ${valMean}%`;
    
    // Check for vol_input_mode (new) or vol_mode (legacy/fallback)
    const mode = savedConfig.vol_input_mode || savedConfig.vol_mode;
    
    if (type === 'flat') {
        details += `, Range: ${savedConfig.vol_min}% to ${savedConfig.vol_max}%`;
    } else if (type === 'student_t') {
        details += `, Scale: ${savedConfig.vol_scale}, DoF: ${savedConfig.vol_freedom}`;
    } else if (type === 'nrig') {
        if (mode === 'simple') {
            details += `, Fatness: ${savedConfig.vol_fatness_level}, Skew: ${savedConfig.vol_skew_level}, Width: ${savedConfig.vol_width_level}`;
        } else {
            details += `, α: ${savedConfig.vol_alpha}, β: ${savedConfig.vol_beta}, δ: ${savedConfig.vol_scale}`;
        }
    }

    const typeLabel = type === 'student_t' ? 'Student-T' : type.toUpperCase();
    return `Active Strategy: ${typeLabel} (${details})`;
  };

  return (
    <div className="space-y-4">
        {/* Volatility Type Selector */}
        <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Volatility Type</label>
            <select
                value={volType}
                onChange={(e) => setVolType(e.target.value)}
                className="block w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
                <option value="none">Standard (No Volatility)</option>
                <option value="flat">Flat Range</option>
                <option value="normal">Normal Distribution</option>
                <option value="student_t">Student's T Distribution</option>
                <option value="nrig">Normal-Reciprocal Inverse Gaussian (NRIG)</option>
            </select>
        </div>

        {/* Expected Monthly Return (Mean) - Shown for all except 'none' and 'flat' */}
        {volType !== 'none' && volType !== 'flat' && (
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Expected Monthly Return (Mean %)</label>
                <input
                    type="number"
                    step="any"
                    value={mean}
                    onChange={(e) => setMean(e.target.value)}
                    className="block w-full rounded border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="0.0"
                />
            </div>
        )}

        {/* Flat Range Parameters */}
        {volType === 'flat' && (
            <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded border border-gray-200">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Min %</label>
                    <input
                        type="number"
                        step="any"
                        value={volMin}
                        onChange={(e) => setVolMin(e.target.value)}
                        className="block w-full rounded border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                        placeholder="-10"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Max %</label>
                    <input
                        type="number"
                        step="any"
                        value={volMax}
                        onChange={(e) => setVolMax(e.target.value)}
                        className="block w-full rounded border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                        placeholder="10"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Intervals</label>
                    <input
                        type="number"
                        value={volIntervals}
                        onChange={(e) => setVolIntervals(e.target.value)}
                        className="block w-full rounded border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                        placeholder="5"
                    />
                </div>
            </div>
        )}

        {/* Normal Distribution Parameters */}
        {volType === 'normal' && (
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Standard Deviation (Scale %)</label>
                    <input
                        type="number"
                        step="any"
                        value={scale}
                        onChange={(e) => setScale(e.target.value)}
                        className="block w-full rounded border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                        placeholder="2.0"
                    />
                </div>
            </div>
        )}

        {/* Student's T Parameters */}
        {volType === 'student_t' && (
            <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded border border-gray-200">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Scale %</label>
                    <input
                        type="number"
                        step="any"
                        value={scale}
                        onChange={(e) => setScale(e.target.value)}
                        className="block w-full rounded border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                        placeholder="2.0"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Degrees of Freedom</label>
                    <input
                        type="number"
                        step="any"
                        value={freedom}
                        onChange={(e) => setFreedom(e.target.value)}
                        className="block w-full rounded border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                        placeholder="4.0"
                    />
                </div>
            </div>
        )}

        {/* NRIG Parameters */}
        {volType === 'nrig' && (
            <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Input Mode</span>
                    <div className="flex rounded-md shadow-sm">
                        <button
                            type="button"
                            onClick={() => setVolMode('simple')}
                            className={`px-3 py-1 text-xs font-medium rounded-l border ${
                                volMode === 'simple'
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            Simple
                        </button>
                        <button
                            type="button"
                            onClick={() => setVolMode('advanced')}
                            className={`px-3 py-1 text-xs font-medium rounded-r border-t border-b border-r ${
                                volMode === 'advanced'
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            Advanced
                        </button>
                    </div>
                </div>

                {volMode === 'simple' ? (
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Fatness</label>
                            <select
                                value={volFatness}
                                onChange={(e) => setVolFatness(e.target.value)}
                                className="block w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
                            >
                                <option value="">Select...</option>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Skew</label>
                            <select
                                value={volSkew}
                                onChange={(e) => setVolSkew(e.target.value)}
                                className="block w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
                            >
                                <option value="">Select...</option>
                                <option value="negative">Negative</option>
                                <option value="symmetric">Symmetric</option>
                                <option value="positive">Positive</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Width</label>
                            <select
                                value={volWidth}
                                onChange={(e) => setVolWidth(e.target.value)}
                                className="block w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
                            >
                                <option value="">Select...</option>
                                <option value="narrow">Narrow</option>
                                <option value="normal">Normal</option>
                                <option value="wide">Wide</option>
                            </select>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Alpha (α)</label>
                            <input
                                type="number"
                                step="any"
                                value={alpha}
                                onChange={(e) => setAlpha(e.target.value)}
                                className="block w-full rounded border border-gray-300 px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
                                placeholder="1.5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Beta (β)</label>
                            <input
                                type="number"
                                step="any"
                                value={beta}
                                onChange={(e) => setBeta(e.target.value)}
                                className="block w-full rounded border border-gray-300 px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
                                placeholder="-0.2"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Scale (δ)</label>
                            <input
                                type="number"
                                step="any"
                                value={scale}
                                onChange={(e) => setScale(e.target.value)}
                                className="block w-full rounded border border-gray-300 px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
                                placeholder="1.0"
                            />
                        </div>
                    </div>
                )}
            </div>
        )}

        {errors.general && <div className="text-red-600 text-xs font-semibold">{errors.general}</div>}

        {/* Summary Card */}
        <div className="mt-4 p-3 bg-gray-100 rounded border text-xs">
            <h4 className="font-bold text-gray-700 mb-1">Active Policy Summary</h4>
            <div className="text-gray-600">
                {renderActiveStrategy()}
            </div>
        </div>

        <button onClick={handleSave} className="w-full bg-indigo-600 text-white py-1.5 rounded text-sm font-bold hover:bg-indigo-700 transition-colors">Update Investment Policy</button>
    </div>
  );
}
