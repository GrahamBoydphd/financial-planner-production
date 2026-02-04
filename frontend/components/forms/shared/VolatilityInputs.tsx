'use client';

import { ALPHA_OPTIONS, BETA_OPTIONS, SCALE_OPTIONS } from '@/lib/presets';
import Tooltip from '@/components/ui/Tooltip';

// --- Validation Helper ---
export interface VolatilityValidationParams {
  min?: string;
  max?: string;
  intervals?: string;
  mean?: string;
  alpha?: string;
  beta?: string;
  scale?: string;
  freedom?: string;
}

export interface VolatilityPayloadResult {
  volatility_type: string;
  growth_rate_percent?: string;
  vol_min?: string;
  vol_max?: string;
  vol_intervals?: number;
  vol_mean?: string;
  vol_alpha?: string;
  vol_beta?: string;
  vol_scale?: string;
  vol_freedom?: string;
}

/**
 * Centralized logic to prepare the volatility payload for the API.
 * Handles the 'Flat' mode mean calculation and parameter mapping.
 */
export function getVolatilityPayload(volType: string, params: VolatilityValidationParams): VolatilityPayloadResult {
  const payload: VolatilityPayloadResult = {
      volatility_type: volType
  };

  const clean = (v?: string) => v && v.trim() !== '' ? v : undefined;

  if (volType === 'flat') {
      const min = parseFloat(params.min || '0');
      const max = parseFloat(params.max || '0');
      const steps = parseInt(params.intervals || '0');
      
      // Calculate derived mean for Flat mode
      const rawAvg = (min + max) / 2;
      const cleanAvg = Math.abs(rawAvg) >= 1 ? rawAvg.toFixed(2) : parseFloat(rawAvg.toPrecision(3)).toString();
      
      payload.growth_rate_percent = cleanAvg;
      payload.vol_min = clean(params.min);
      payload.vol_max = clean(params.max);
      payload.vol_intervals = steps > 0 ? steps : undefined;
  } else {
      // For none, nrig, student_t, the user input mean is the growth rate
      payload.growth_rate_percent = clean(params.mean);
      
      if (volType === 'nrig') {
          payload.vol_mean = clean(params.mean);
          payload.vol_alpha = clean(params.alpha);
          
          // Calculate safe beta based on ratio
          const rawAlpha = parseFloat(params.alpha || '0');
          const rawBetaRatio = parseFloat(params.beta || '0');
          const safeBeta = rawAlpha * rawBetaRatio;
          payload.vol_beta = safeBeta.toString();

          payload.vol_scale = clean(params.scale);
      } else if (volType === 'student_t') {
          payload.vol_mean = clean(params.mean);
          payload.vol_scale = clean(params.scale);
          payload.vol_freedom = clean(params.freedom);
      }
  }
  
  return payload;
}

export function validateVolatilityParams(volType: string, params: VolatilityValidationParams): string[] {
  const errors: string[] = [];

  if (volType === 'flat') {
    const min = parseFloat(params.min || '');
    const max = parseFloat(params.max || '');
    const steps = parseInt(params.intervals || '');

    if (isNaN(min) || isNaN(max) || isNaN(steps)) {
        errors.push("Min, Max, and Number of Steps are required for Flat volatility");
    } else {
        if (steps < 1) errors.push("Steps must be at least 1");
        if (min >= max) errors.push("Min growth must be less than Max growth");
    }
  } else if (volType === 'nrig') {
    if (!params.mean || isNaN(Number(params.mean))) {
        errors.push("Average Growth Rate is required");
    }
    if (!params.alpha) errors.push("Alpha (Likelihood) is required");
    if (!params.beta) errors.push("Beta (Skew) is required");
    if (!params.scale) errors.push("Scale (Delta) is required");
  } else if (volType === 'student_t') {
    if (!params.mean || isNaN(Number(params.mean))) {
        errors.push("Average Growth Rate is required");
    }
    if (!params.scale) errors.push("Scale is required");
    if (!params.freedom) errors.push("Degrees of Freedom is required");
  }

  return errors;
}

interface VolatilityInputsProps {
  volType: string;
  setVolType: (val: string) => void;
  
  // Parameters
  volMean: string;
  setVolMean: (val: string) => void;
  volMin: string;
  setVolMin: (val: string) => void;
  volMax: string;
  setVolMax: (val: string) => void;
  volIntervals: string;
  setVolIntervals: (val: string) => void;
  volScale: string;
  setVolScale: (val: string) => void;
  volFreedom: string;
  setVolFreedom: (val: string) => void;
  volAlpha: string;
  setVolAlpha: (val: string) => void;
  volBeta: string;
  setVolBeta: (val: string) => void;

  // UI Mode
  isAdvanced: boolean;
  setIsAdvanced: (val: boolean) => void;

  // Optional Overrides
  meanLabel?: string;
  alwaysShowMean?: boolean;
}

export default function VolatilityInputs({
  volType, setVolType,
  volMean, setVolMean,
  volMin, setVolMin,
  volMax, setVolMax,
  volIntervals, setVolIntervals,
  volScale, setVolScale,
  volFreedom, setVolFreedom,
  volAlpha, setVolAlpha,
  volBeta, setVolBeta,
  isAdvanced, setIsAdvanced,
  meanLabel,
  alwaysShowMean
}: VolatilityInputsProps) {

  // Helper to find description
  const getAlphaDesc = () => ALPHA_OPTIONS.find(o => o.value.toString() === volAlpha)?.description;
  const getBetaDesc = () => BETA_OPTIONS.find(o => o.value.toString() === volBeta)?.description;
  const getScaleDesc = () => SCALE_OPTIONS.find(o => o.value.toString() === volScale)?.description;

  return (
    <div className="border-t pt-2 mt-2">
      <div className="flex justify-between items-center mb-1">
           <label className="text-xs font-bold text-gray-700">Uncertainty / Risk Model</label>
           {volType === 'nrig' && (
               <button type="button" onClick={() => setIsAdvanced(!isAdvanced)} className="text-xs text-blue-600 underline">
                   {isAdvanced ? 'Switch to Simple Mode' : 'Switch to Advanced Mode'}
               </button>
           )}
      </div>
      <div className="space-y-2">
          <div>
              <label className="text-xs text-gray-500">Model Type</label>
              <select className="w-full border p-1 rounded text-xs" value={volType} onChange={e => setVolType(e.target.value)}>
                  <option value="none" disabled hidden>-- Select Risk Model --</option>
                  <option value="flat">Simple volatility (min/max)</option>
                  <option value="nrig">Comprehensive volatility</option>
                  <option value="student_t">Student's t distribution</option>
              </select>
          </div>
          
          {volType !== 'none' && (
            <div className="bg-gray-100 p-2 rounded">
               
               {/* SIMPLE MODE DROPDOWNS (NRIG Only) */}
               {!isAdvanced && volType === 'nrig' && (
                   <div className="space-y-3">
                       <div className="text-xs text-gray-600 italic mb-2">
                          Tier 1: Configure the shape of uncertainty.
                       </div>
                       <div>
                           <label className="text-xs text-gray-500 flex items-center gap-1">
                              Likelyhood of outliers (tail weight)
                              <Tooltip content="Controls how often extreme events (white and black swans) occur." />
                           </label>
                           <select className="w-full border p-1 rounded text-xs" value={volAlpha} onChange={e => setVolAlpha(e.target.value)}>
                               <option value="">-- Select --</option>
                               {ALPHA_OPTIONS.map(o => (
                                   <option key={o.value} value={o.value}>{o.label} </option>
                               ))}
                           </select>
                           <p className="text-xs text-gray-400 italic mt-1">{getAlphaDesc()}</p>
                       </div>

                       <div>
                           <label className="text-xs text-gray-500 flex items-center gap-1">
                              Volatility imbalance (downside / upside)
                              <Tooltip content="Skewness: Are surprises more likely to be positive or negative?" />
                           </label>
                           <select className="w-full border p-1 rounded text-xs" value={volBeta} onChange={e => setVolBeta(e.target.value)}>
                               <option value="">-- Select --</option>
                               {BETA_OPTIONS.map(o => (
                                   <option key={o.value} value={o.value}>{o.label}</option>
                               ))}
                           </select>
                           <p className="text-xs text-gray-400 italic mt-1">{getBetaDesc()}</p>
                       </div>

                       <div>
                           <label className="text-xs text-gray-500 block">Delta/Scale (Volatility)</label>
                           <select className="w-full border p-1 rounded text-xs" value={volScale} onChange={e => setVolScale(e.target.value)}>
                               <option value="">-- Select --</option>
                               {SCALE_OPTIONS.map(o => (
                                   <option key={o.value} value={o.value}>{o.label}</option>
                               ))}
                           </select>
                           <p className="text-xs text-gray-400 italic mt-1">{getScaleDesc()}</p>
                       </div>
                   </div>
               )}

               {/* ADVANCED INPUTS OR OTHER MODELS */}
               {/* Hidden if in Simple NRIG mode, unless we need to show the Mean (Capital Growth) */}
               <div className={`grid grid-cols-3 gap-2 items-end ${(!isAdvanced && volType === 'nrig' && !alwaysShowMean) ? 'hidden' : ''}`}>
                   
                   {/* Common Mean */}
                   {(isAdvanced || alwaysShowMean) && (
                     <div className="col-span-3">
                         <label className="text-xs text-gray-400">{meanLabel || "Mean / Drift (Optional Override)"}</label>
                         <input 
                            type="number" 
                            step="any"
                            placeholder="Default = Growth Rate" 
                            className="w-full border p-1 text-xs" 
                            value={volMean} 
                            onChange={e => setVolMean(e.target.value)} 
                         />
                     </div>
                   )}

                   {/* Flat Params */}
                   {volType === 'flat' && (
                      <>
                          <div className="col-span-3 flex items-center gap-2 mb-1 mt-2">
                              <span className="text-xs font-bold text-gray-500">Range Settings</span>
                              <Tooltip content="Define a hard minimum and maximum percentage deviation." />
                          </div>
                          <div>
                              <label className="text-xs text-gray-400">Min %</label>
                              <input className="w-full border p-1 text-xs" value={volMin} onChange={e => setVolMin(e.target.value)} />
                          </div>
                          <div>
                              <label className="text-xs text-gray-400">Max %</label>
                              <input className="w-full border p-1 text-xs" value={volMax} onChange={e => setVolMax(e.target.value)} />
                          </div>
                          <div>
                              <label className="text-xs text-gray-400">Steps</label>
                              <input className="w-full border p-1 text-xs" value={volIntervals} onChange={e => setVolIntervals(e.target.value)} />
                          </div>
                          <div>
                              <label className="text-xs text-gray-400">Average (Calculated)</label>
                              <input 
                                  className="w-full border p-1 text-xs bg-gray-100 text-gray-500 cursor-not-allowed" 
                                  readOnly
                                  value={((parseFloat(volMin||'0') + parseFloat(volMax||'0')) / 2).toFixed(2) + " %"} 
                              />
                          </div>
                      </>
                   )}

                   {/* Student-T Params */}
                   {volType === 'student_t' && (
                      <>
                          <div>
                              <label className="text-xs text-gray-400">Scale (Vol)</label>
                              <input className="w-full border p-1 text-xs" value={volScale} onChange={e => setVolScale(e.target.value)} />
                          </div>
                          <div>
                              <label className="text-xs text-gray-400">Freedom (Deg)</label>
                              <input className="w-full border p-1 text-xs" value={volFreedom} onChange={e => setVolFreedom(e.target.value)} />
                          </div>
                      </>
                   )}

                   {/* NRIG Params (Advanced) */}
                   {volType === 'nrig' && isAdvanced && (
                      <>
                          <div>
                              <label className="text-xs text-gray-400">Likelyhood (Alpha)</label>
                              <input className="w-full border p-1 text-xs" value={volAlpha} onChange={e => setVolAlpha(e.target.value)} />
                          </div>
                          <div>
                              <label className="text-xs text-gray-400">Skew (Imbalance, Beta)</label>
                              <input className="w-full border p-1 text-xs" value={volBeta} onChange={e => setVolBeta(e.target.value)} />
                          </div>
                          <div>
                              <label className="text-xs text-gray-400">Scale (Delta)</label>
                              <input className="w-full border p-1 text-xs" value={volScale} onChange={e => setVolScale(e.target.value)} />
                          </div>
                      </>
                   )}
               </div>
            </div>
          )}
      </div>
    </div>
  );
}
