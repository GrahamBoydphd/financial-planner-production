'use client';

import React from 'react';
import { ALPHA_OPTIONS, BETA_OPTIONS, SCALE_OPTIONS } from '@/lib/presets';
import Tooltip from '@/components/ui/Tooltip';

// --- Legacy Types & Validation Helpers (Retained for Backward Compatibility) ---
export interface VolatilityValidationParams {
  min?: string;
  max?: string;
  intervals?: string;
  mean?: string;
  alpha?: string;
  beta?: string;
  scale?: string;
  freedom?: string;
  fatness?: string;
  skew?: string;
  width?: string;
}

export interface VolatilityPayloadResult {
  volatility_type: string;
  growth_rate_percent?: string;
  target_mean?: string;
  vol_input_mode?: 'simple' | 'advanced';
  vol_mode?: 'simple' | 'advanced';
  vol_fatness_level?: string;
  vol_skew_level?: string;
  vol_width_level?: string;
  vol_min?: string;
  vol_max?: string;
  vol_intervals?: number;
  vol_mean?: string;
  vol_alpha?: string;
  vol_beta?: string;
  vol_scale?: string;
  vol_freedom?: string;
}

export interface VolatilityUIState {
  volType: string;
  volMode: 'simple' | 'advanced';
  volMean: string;
  volMin: string;
  volMax: string;
  volIntervals: string;
  volScale: string;
  volFreedom: string;
  volAlpha: string;
  volBeta: string;
  volFatness: string;
  volSkew: string;
  volWidth: string;
}

/**
 * Centralized helper to map API data to UI state for Volatility Inputs.
 * Handles NRIG Beta Ratio recovery and Hybrid Mode loading.
 */
export function getVolatilityUIState(data: any): VolatilityUIState {
  if (!data) {
      return {
          volType: 'none',
          volMode: 'simple',
          volMean: '',
          volMin: '',
          volMax: '',
          volIntervals: '',
          volScale: '',
          volFreedom: '',
          volAlpha: '',
          volBeta: '',
          volFatness: '',
          volSkew: '',
          volWidth: ''
      };
  }

  const volType = (data.volatility_type && data.volatility_type !== 'none') ? data.volatility_type : 'none';
  
  // Map vol_input_mode -> volMode (Priority: vol_input_mode > vol_mode > default)
  const volMode = (data.vol_input_mode === 'simple' || data.vol_input_mode === 'advanced') 
      ? data.vol_input_mode 
      : ((data.vol_mode === 'simple' || data.vol_mode === 'advanced') ? data.vol_mode : 'simple');

  const str = (v: any) => (v !== undefined && v !== null) ? String(v) : '';

  // Mean mapping: target_mean -> growth_rate_percent -> vol_mean
  const volMean = (data.target_mean !== undefined && data.target_mean !== null)
      ? String(data.target_mean)
      : (data.growth_rate_percent !== undefined && data.growth_rate_percent !== null)
          ? String(data.growth_rate_percent)
          : str(data.vol_mean);

  const volMin = str(data.vol_min);
  const volMax = str(data.vol_max);
  const volIntervals = str(data.vol_intervals);
  const volScale = str(data.vol_scale);
  const volFreedom = str(data.vol_freedom);
  const volAlpha = str(data.vol_alpha);
  
  let volBeta = str(data.vol_beta);

  // NRIG Beta Recovery: stored beta is (alpha * ratio). UI needs ratio.
  if (volType === 'nrig' && volAlpha && Number(volAlpha) !== 0 && volBeta) {
      const ratio = Number(volBeta) / Number(volAlpha);
      volBeta = ratio.toFixed(1);
  }

  // Simple Mode Keys
  const volFatness = str(data.vol_fatness_level);
  const volSkew = str(data.vol_skew_level);
  const volWidth = str(data.vol_width_level);

  return {
      volType,
      volMode,
      volMean,
      volMin,
      volMax,
      volIntervals,
      volScale,
      volFreedom,
      volAlpha,
      volBeta,
      volFatness,
      volSkew,
      volWidth
  };
}

/**
 * Centralized logic to prepare the volatility payload for the API.
 * Handles the 'Flat' mode mean calculation and parameter mapping.
 */
export function getVolatilityPayload(volType: string, params: VolatilityValidationParams, volMode: 'simple' | 'advanced' = 'simple'): VolatilityPayloadResult {
  const payload: VolatilityPayloadResult = {
      volatility_type: volType,
      vol_input_mode: volMode,
      vol_mode: volMode // Legacy support
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
      payload.target_mean = cleanAvg; // Required mapping
      payload.vol_min = clean(params.min);
      payload.vol_max = clean(params.max);
      payload.vol_intervals = steps > 0 ? steps : undefined;
  } else {
      // For none, nrig, student_t, the user input mean is the growth rate
      payload.growth_rate_percent = clean(params.mean);
      payload.target_mean = clean(params.mean); // Required mapping
      
      if (volType === 'nrig') {
          payload.vol_mean = clean(params.mean);
          // vol_input_mode and vol_mode are now set at top level

          if (volMode === 'simple') {
              payload.vol_fatness_level = clean(params.fatness);
              payload.vol_skew_level = clean(params.skew);
              payload.vol_width_level = clean(params.width);
          } else {
              // Advanced
              payload.vol_alpha = clean(params.alpha);
              
              // Calculate safe beta based on ratio
              const rawAlpha = parseFloat(params.alpha || '0');
              const rawBetaRatio = parseFloat(params.beta || '0');
              const safeBeta = rawAlpha * rawBetaRatio;
              payload.vol_beta = safeBeta.toString();

              payload.vol_scale = clean(params.scale);
          }
      } else if (volType === 'student_t') {
          payload.vol_mean = clean(params.mean);
          payload.vol_scale = clean(params.scale);
          payload.vol_freedom = clean(params.freedom);
      }
  }
  
  return payload;
}

export function validateVolatilityParams(volType: string, volMode: 'simple' | 'advanced', params: VolatilityValidationParams): string[] {
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
    
    if (volMode === 'simple') {
        if (!params.fatness) errors.push("Likelihood (Fatness) is required");
        if (!params.skew) errors.push("Skew (Imbalance) is required");
        if (!params.width) errors.push("Volatility (Width) is required");
    } else {
        if (!params.alpha) errors.push("Alpha (Likelihood) is required");
        if (!params.beta) errors.push("Beta (Skew) is required");
        if (!params.scale) errors.push("Scale (Delta) is required");
    }
  } else if (volType === 'student_t') {
    if (!params.mean || isNaN(Number(params.mean))) {
        errors.push("Average Growth Rate is required");
    }
    if (!params.scale) errors.push("Scale is required");
    if (!params.freedom) errors.push("Degrees of Freedom is required");
  }

  return errors;
}

// --- New Dual-Stochastic Volatility Interface & Component ---

export interface VolatilityConfig {
  mode_name: 'compounding_growth' | 'transient_noise';
  volatility_type: string;
  target_mean?: string;
  vol_input_mode?: 'simple' | 'advanced';
  vol_fatness_level?: string;
  vol_skew_level?: string;
  vol_width_level?: string;
  vol_alpha?: string;
  vol_beta?: string;
  vol_scale?: string;
  vol_freedom?: string;
  vol_min?: string;
  vol_max?: string;
  vol_intervals?: number;
}

interface VolatilityInputsProps {
  configs: VolatilityConfig[];
  onChange: (updatedConfigs: VolatilityConfig[]) => void;
}

export default function VolatilityInputs({ configs, onChange }: VolatilityInputsProps) {
  // Local state to manage the internal UI representation of the configs
  const [localConfigs, setLocalConfigs] = React.useState<VolatilityConfig[]>(configs || []);

  // Sync internal state with incoming configs prop (e.g., when loading an item to edit)
  React.useEffect(() => {
    if (configs) {
      setLocalConfigs(configs);
    } else {
      setLocalConfigs([]);
    }
  }, [configs]);
  
  const handleToggle = (mode: 'compounding_growth' | 'transient_noise', checked: boolean) => {
    let updated: VolatilityConfig[];
    if (checked) {
      // Check if there's already an existing config in the incoming configs prop for this mode to preserve legacy data
      const existing = configs?.find(c => c.mode_name === mode);
      const newConfig: VolatilityConfig = existing ? { ...existing } : {
        mode_name: mode,
        volatility_type: '', // Requires user selection
        vol_input_mode: 'simple',
        target_mean: '0.0',
        vol_min: '',
        vol_max: '',
        vol_intervals: 0, // Strict integer
        vol_scale: '',
        vol_freedom: '',
        vol_alpha: '',
        vol_beta: '',
        vol_fatness_level: '',
        vol_skew_level: '',
        vol_width_level: ''
      };
      updated = [...localConfigs, newConfig];
    } else {
      updated = localConfigs.filter(c => c.mode_name !== mode);
    }
    setLocalConfigs(updated);
    onChange(updated);
  };

  const handleFieldChange = (mode: 'compounding_growth' | 'transient_noise', field: keyof VolatilityConfig, value: any) => {
    const updated = localConfigs.map(c => {
      if (c.mode_name === mode) {
        const next = { ...c, [field]: value };
        if (next.volatility_type === 'flat') {
          const minStr = next.vol_min !== undefined && next.vol_min !== null ? String(next.vol_min) : '';
          const maxStr = next.vol_max !== undefined && next.vol_max !== null ? String(next.vol_max) : '';
          const minVal = parseFloat(minStr);
          const maxVal = parseFloat(maxStr);
          if (!isNaN(minVal) && !isNaN(maxVal)) {
            next.target_mean = ((minVal + maxVal) / 2).toFixed(2);
          } else {
            next.target_mean = '';
          }
        }
        return next;
      }
      return c;
    });
    setLocalConfigs(updated);
    onChange(updated);
  };

  const handleTypeChange = (mode: 'compounding_growth' | 'transient_noise', type: string) => {
    const updated = localConfigs.map(c => {
      if (c.mode_name === mode) {
        const base: VolatilityConfig = {
          ...c,
          volatility_type: type,
        };
        if (type === 'nrig') {
          base.vol_input_mode = base.vol_input_mode || 'simple';
          base.vol_fatness_level = base.vol_fatness_level || 'medium';
          base.vol_skew_level = base.vol_skew_level || 'symmetric';
          base.vol_width_level = base.vol_width_level || 'medium';
        } else if (type === 'student_t') {
          base.vol_scale = base.vol_scale || '0.05';
          base.vol_freedom = base.vol_freedom || '5.0';
        } else if (type === 'normal') {
          base.vol_scale = base.vol_scale || '0.05';
        } else if (type === 'flat') {
          base.vol_min = base.vol_min !== undefined && base.vol_min !== null ? String(base.vol_min) : '0.0';
          base.vol_max = base.vol_max !== undefined && base.vol_max !== null ? String(base.vol_max) : '0.0';
          base.vol_intervals = base.vol_intervals !== undefined && base.vol_intervals !== null ? Number(base.vol_intervals) : 10;
        }
        return base;
      }
      return c;
    });
    setLocalConfigs(updated);
    onChange(updated);
  };

  const panels: { id: 'compounding_growth' | 'transient_noise'; title: string; description: string }[] = [
    {
      id: 'compounding_growth',
      title: 'Compounding Growth Volatility',
      description: 'Permanently alters the underlying financial trajectory, compounding structurally over time.',
    },
    {
      id: 'transient_noise',
      title: 'Transient Operational Noise',
      description: 'Temporary, non-compounding month-to-month fluctuations affecting a specific month reported cash flow only.',
    },
  ];

  return (
    <div className="space-y-4">
      {/* User Instruction Text */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 font-medium">
        Notice: You must select at least one volatility force (Compounding Growth, Transient Noise, or both) to run the simulation engine.
      </div>

      {/* Vertically Stacked Layout */}
      <div className="space-y-4">
        {panels.map(panel => {
          const config = localConfigs.find(c => c.mode_name === panel.id);
          const isEnabled = !!config;

          return (
            <div key={panel.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`toggle-${panel.id}`}
                    checked={isEnabled}
                    onChange={(e) => handleToggle(panel.id, e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor={`toggle-${panel.id}`} className="text-sm font-bold text-gray-800 cursor-pointer select-none">
                    {panel.title}
                  </label>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-3">{panel.description}</p>

              {isEnabled && (
                <div className="space-y-3 border-t border-gray-100 pt-3 mt-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Volatility Type</label>
                    <select
                      value={config.volatility_type}
                      onChange={(e) => handleTypeChange(panel.id, e.target.value)}
                      className="w-full border border-gray-300 p-2 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="" disabled hidden>-- Choose the distribution --</option>
                      <option value="flat">Simple volatility (min/max)</option>
                      <option value="nrig">Comprehensive volatility</option>
                      <option value="normal">Normal distribution</option>
                      <option value="student_t">{"Student's t distribution"}</option>
                    </select>
                  </div>

                  {/* Render inputs based on volatility_type */}
                  {config.volatility_type === 'nrig' && (
                    <div className="space-y-3 bg-gray-50 p-3 rounded border border-gray-200">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-gray-700">NRIG Configuration</span>
                        <button
                          type="button"
                          onClick={() => handleFieldChange(panel.id, 'vol_input_mode', config.vol_input_mode === 'advanced' ? 'simple' : 'advanced')}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {config.vol_input_mode === 'advanced' ? 'Switch to Simple Mode' : 'Switch to Advanced Mode'}
                        </button>
                      </div>

                      {config.vol_input_mode === 'simple' ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-gray-600 flex items-center gap-1 mb-1">
                              Likelihood of outliers (tail weight / fatness)
                              <Tooltip content="Controls how often extreme events (white and black swans) occur." />
                            </label>
                            <select
                              value={config.vol_fatness_level || ''}
                              onChange={(e) => handleFieldChange(panel.id, 'vol_fatness_level', e.target.value)}
                              className="w-full border border-gray-300 p-2 rounded text-xs"
                            >
                              <option value="">-- Select --</option>
                              {ALPHA_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            {config.vol_fatness_level && (
                              <p className="text-[11px] text-gray-400 italic mt-1">
                                {ALPHA_OPTIONS.find(o => o.value === config.vol_fatness_level)?.description}
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="text-xs text-gray-600 flex items-center gap-1 mb-1">
                              Volatility imbalance (downside / upside skew)
                              <Tooltip content="Skewness: Are surprises more likely to be positive or negative?" />
                            </label>
                            <select
                              value={config.vol_skew_level || ''}
                              onChange={(e) => handleFieldChange(panel.id, 'vol_skew_level', e.target.value)}
                              className="w-full border border-gray-300 p-2 rounded text-xs"
                            >
                              <option value="">-- Select --</option>
                              {BETA_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            {config.vol_skew_level && (
                              <p className="text-[11px] text-gray-400 italic mt-1">
                                {BETA_OPTIONS.find(o => o.value === config.vol_skew_level)?.description}
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="text-xs text-gray-600 flex items-center gap-1 mb-1">
                              Delta/Scale (Volatility width)
                              <Tooltip content="Controls the overall width of the distribution." />
                            </label>
                            <select
                              value={config.vol_width_level || ''}
                              onChange={(e) => handleFieldChange(panel.id, 'vol_width_level', e.target.value)}
                              className="w-full border border-gray-300 p-2 rounded text-xs"
                            >
                              <option value="">-- Select --</option>
                              {SCALE_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            {config.vol_width_level && (
                              <p className="text-[11px] text-gray-400 italic mt-1">
                                {SCALE_OPTIONS.find(o => o.value === config.vol_width_level)?.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[11px] text-gray-600 mb-1">Alpha (Likelihood)</label>
                            <input
                              type="text"
                              value={config.vol_alpha || ''}
                              onChange={(e) => handleFieldChange(panel.id, 'vol_alpha', e.target.value)}
                              className="w-full border border-gray-300 p-2 rounded text-xs"
                              placeholder="e.g. 1.5"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-gray-600 mb-1">Beta (Skew)</label>
                            <input
                              type="text"
                              value={config.vol_beta || ''}
                              onChange={(e) => handleFieldChange(panel.id, 'vol_beta', e.target.value)}
                              className="w-full border border-gray-300 p-2 rounded text-xs"
                              placeholder="e.g. -0.2"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-gray-600 mb-1">Scale (Delta)</label>
                            <input
                              type="text"
                              value={config.vol_scale || ''}
                              onChange={(e) => handleFieldChange(panel.id, 'vol_scale', e.target.value)}
                              className="w-full border border-gray-300 p-2 rounded text-xs"
                              placeholder="e.g. 0.05"
                            />
                          </div>
                        </div>
                      )}

                      {panel.id === 'compounding_growth' && (
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Target Mean / Drift</label>
                          <input
                            type="text"
                            value={config.target_mean || ''}
                            onChange={(e) => handleFieldChange(panel.id, 'target_mean', e.target.value)}
                            className="w-full border border-gray-300 p-2 rounded text-xs"
                            placeholder="e.g. 0.0"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {config.volatility_type === 'student_t' && (
                    <div className="space-y-3 bg-gray-50 p-3 rounded border border-gray-200">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Scale (Volatility)</label>
                          <input
                            type="text"
                            value={config.vol_scale || ''}
                            onChange={(e) => handleFieldChange(panel.id, 'vol_scale', e.target.value)}
                            className="w-full border border-gray-300 p-2 rounded text-xs"
                            placeholder="e.g. 0.05"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Degrees of Freedom</label>
                          <input
                            type="text"
                            value={config.vol_freedom || ''}
                            onChange={(e) => handleFieldChange(panel.id, 'vol_freedom', e.target.value)}
                            className="w-full border border-gray-300 p-2 rounded text-xs"
                            placeholder="e.g. 5.0"
                          />
                        </div>
                      </div>
                      {panel.id === 'compounding_growth' && (
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Target Mean / Drift</label>
                          <input
                            type="text"
                            value={config.target_mean || ''}
                            onChange={(e) => handleFieldChange(panel.id, 'target_mean', e.target.value)}
                            className="w-full border border-gray-300 p-2 rounded text-xs"
                            placeholder="e.g. 0.0"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {config.volatility_type === 'normal' && (
                    <div className="space-y-3 bg-gray-50 p-3 rounded border border-gray-200">
                      <div className={`grid ${panel.id === 'compounding_growth' ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Scale (Volatility)</label>
                          <input
                            type="text"
                            value={config.vol_scale || ''}
                            onChange={(e) => handleFieldChange(panel.id, 'vol_scale', e.target.value)}
                            className="w-full border border-gray-300 p-2 rounded text-xs"
                            placeholder="e.g. 0.05"
                          />
                        </div>
                        {panel.id === 'compounding_growth' && (
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Target Mean / Drift</label>
                            <input
                              type="text"
                              value={config.target_mean || ''}
                              onChange={(e) => handleFieldChange(panel.id, 'target_mean', e.target.value)}
                              className="w-full border border-gray-300 p-2 rounded text-xs"
                              placeholder="e.g. 0.0"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {config.volatility_type === 'flat' && (
                    <div className="space-y-3 bg-gray-50 p-3 rounded border border-gray-200">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Min %</label>
                          <input
                            type="text"
                            value={config.vol_min !== undefined && config.vol_min !== null ? String(config.vol_min) : ''}
                            onChange={(e) => handleFieldChange(panel.id, 'vol_min', e.target.value)}
                            className="w-full border border-gray-300 p-2 rounded text-xs"
                            placeholder="e.g. -5.0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Max %</label>
                          <input
                            type="text"
                            value={config.vol_max !== undefined && config.vol_max !== null ? String(config.vol_max) : ''}
                            onChange={(e) => handleFieldChange(panel.id, 'vol_max', e.target.value)}
                            className="w-full border border-gray-300 p-2 rounded text-xs"
                            placeholder="e.g. 5.0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Steps</label>
                          <input
                            type="number"
                            value={config.vol_intervals !== undefined && config.vol_intervals !== null ? config.vol_intervals : ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              handleFieldChange(panel.id, 'vol_intervals', isNaN(val) ? 0 : val);
                            }}
                            className="w-full border border-gray-300 p-2 rounded text-xs"
                            placeholder="e.g. 10"
                          />
                        </div>
                        {panel.id === 'compounding_growth' && (
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Average (Calculated)</label>
                            <input
                              type="text"
                              readOnly
                              value={(() => {
                                const minStr = config.vol_min !== undefined && config.vol_min !== null ? String(config.vol_min) : '';
                                const maxStr = config.vol_max !== undefined && config.vol_max !== null ? String(config.vol_max) : '';
                                if (minStr === '' || maxStr === '') return '';
                                const minVal = parseFloat(minStr);
                                const maxVal = parseFloat(maxStr);
                                if (isNaN(minVal) || isNaN(maxVal)) return '';
                                return ((minVal + maxVal) / 2).toFixed(2);
                              })()}
                              className="w-full border border-gray-300 p-2 rounded text-xs bg-gray-100 cursor-not-allowed"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
