'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import VolatilityInputs, { getVolatilityPayload, validateVolatilityParams, getVolatilityUIState } from '@/components/forms/shared/VolatilityInputs';

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
    <div className="space-y-3">
        <VolatilityInputs
            volType={volType}
            setVolType={setVolType}
            volMean={mean}
            setVolMean={setMean}
            volMin={volMin}
            setVolMin={setVolMin}
            volMax={volMax}
            setVolMax={setVolMax}
            volIntervals={volIntervals}
            setVolIntervals={setVolIntervals}
            volScale={scale}
            setVolScale={setScale}
            volFreedom={freedom}
            setVolFreedom={setFreedom}
            volAlpha={alpha}
            setVolAlpha={setAlpha}
            volBeta={beta}
            setVolBeta={setBeta}
            volMode={volMode}
            setVolMode={setVolMode}
            volFatness={volFatness}
            setVolFatness={setVolFatness}
            volSkew={volSkew}
            setVolSkew={setVolSkew}
            volWidth={volWidth}
            setVolWidth={setVolWidth}
            meanLabel='Expected Monthly Return (Mean %)'
            alwaysShowMean={volType !== "flat"}
        />

        {errors.general && <div className="text-red-600 text-xs font-semibold">{errors.general}</div>}

        {/* Summary Card */}
        <div className="mt-4 p-3 bg-gray-100 rounded border text-xs">
            <h4 className="font-bold text-gray-700 mb-1">Active Policy Summary</h4>
            <div className="text-gray-600">
                {renderActiveStrategy()}
            </div>
        </div>

        <button onClick={handleSave} className="w-full bg-indigo-600 text-white py-1 rounded text-sm font-bold">Update Investment Policy</button>
    </div>
  );
}
