'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import VolatilityInputs from './shared/VolatilityInputs';

interface Props {
  planId: string;
  onSuccess: () => void;
}

export default function CapitalGrowthForm({ planId, onSuccess }: Props) {
  const [volType, setVolType] = useState('none');
  
  // Flat / Student-T / NRIG Params
  const [mean, setMean] = useState('');     // Mean / Mu
  const [volMin, setVolMin] = useState(''); // Min
  const [volMax, setVolMax] = useState(''); // Max
  const [volIntervals, setVolIntervals] = useState('');
  
  // Specific NRIG / Student-T Params
  const [alpha, setAlpha] = useState('');
  const [beta, setBeta] = useState('');
  const [scale, setScale] = useState(''); // Delta / Scale
  const [freedom, setFreedom] = useState('');

  // UI State
  const [isAdvanced, setIsAdvanced] = useState(false);

  useEffect(() => {
    let active = true;
    api.getCapitalGrowth(planId).then(p => {
      if (!active) return;
      const vType = p.volatility_type || 'none';
      setVolType(vType);
      setMean(p.vol_mean !== undefined ? p.vol_mean.toString() : '');
      setVolMin(p.vol_min !== undefined ? p.vol_min.toString() : '');
      setVolMax(p.vol_max !== undefined ? p.vol_max.toString() : '');
      setVolIntervals(p.vol_intervals !== undefined ? p.vol_intervals.toString() : '');
      
      setAlpha(p.vol_alpha !== undefined ? p.vol_alpha.toString() : '');
      setBeta(p.vol_beta !== undefined ? p.vol_beta.toString() : '');
      setScale(p.vol_scale !== undefined ? p.vol_scale.toString() : '');
      setFreedom(p.vol_freedom !== undefined ? p.vol_freedom.toString() : '');
    }).catch(() => {});
    return () => { active = false; };
  }, [planId]);

  const handleSave = async () => {
    await api.upsertCapitalGrowth({
        plan_id: planId,
        volatility_type: volType as any,
        
        // Common / Student T / NRIG
        vol_mean: mean ? Number(mean) : undefined,
        
        // Flat Only
        vol_min: volType === 'flat' && volMin ? Number(volMin) : undefined,
        vol_max: volType === 'flat' && volMax ? Number(volMax) : undefined,
        vol_intervals: volType === 'flat' && volIntervals ? Number(volIntervals) : undefined,
        
        // NRIG Only
        vol_alpha: volType === 'nrig' && alpha ? Number(alpha) : undefined,
        vol_beta: volType === 'nrig' && beta ? Number(beta) : undefined,
        vol_scale: (volType === 'nrig' || volType === 'student_t') && scale ? Number(scale) : undefined, 
        vol_freedom: volType === 'student_t' && freedom ? Number(freedom) : undefined,
    });
    onSuccess();
  };

  return (
    <div className="space-y-3">
        <div className="flex justify-between items-center">
            <label className="text-xs text-gray-500 block">Investment Strategy (Risk Model)</label>
        </div>

        {/* SHARED VOLATILITY COMPONENT */}
        <VolatilityInputs 
            volType={volType} setVolType={setVolType}
            volMean={mean} setVolMean={setMean}
            volMin={volMin} setVolMin={setVolMin}
            volMax={volMax} setVolMax={setVolMax}
            volIntervals={volIntervals} setVolIntervals={setVolIntervals}
            volScale={scale} setVolScale={setScale}
            volFreedom={freedom} setVolFreedom={setFreedom}
            volAlpha={alpha} setVolAlpha={setAlpha}
            volBeta={beta} setVolBeta={setBeta}
            isAdvanced={isAdvanced} setIsAdvanced={setIsAdvanced}
            meanLabel="Expected Monthly Return (Mean %)"
            alwaysShowMean={true}
        />

        {volType !== 'none' && (
             <p className="text-xs text-gray-400 mt-1">
                Calculated on positive cash balance at month end.
             </p>
        )}

        <button onClick={handleSave} className="w-full bg-indigo-600 text-white py-1 rounded text-sm font-bold mt-2">Update Investment Policy</button>
    </div>
  );
}
