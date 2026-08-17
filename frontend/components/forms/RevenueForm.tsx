'use client';

import { useState, useEffect } from 'react';
import { api, RevenueItem } from '@/lib/api';
import Tooltip from '@/components/ui/Tooltip';
import VolatilityInputs, { VolatilityConfig } from '@/components/forms/shared/VolatilityInputs';

const getOperatorSymbol = (op: string | null | undefined): string => {
  if (!op) return '>';
  if (op.includes('greater_than')) return '>';
  if (op.includes('less_than')) return '<';
  return '>';
};

interface Props {
  planId: string;
  onSuccess: () => void;
  itemToEdit?: RevenueItem | null;
  onCancel?: () => void;
  currencySymbol?: string;
}

export default function RevenueForm({ planId, onSuccess, itemToEdit, onCancel, currencySymbol = '$' }: Props) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('sales');
  const [amount, setAmount] = useState('');
  const [startMonth, setStartMonth] = useState('1');
  const [endMonth, setEndMonth] = useState('');
  const [freq, setFreq] = useState('monthly');

  // Ordered Phase Array State
  const [phases, setPhases] = useState<any[]>([
    {
      phase_sequence: 1,
      trigger_strategy: 'time_based',
      trigger_month: null,
      trigger_offset: '',
      trigger_threshold: '',
      trigger_metric_basis: 'monthly',
      trigger_comparison_operator: 'greater_than',
      growth_rate_percent: '0.00',
      cost_of_revenue_percent: '',
      pct_of_revenue: '',
      baseline_increment: '',
      is_fixed_stream: false,
      volatility_configs: []
    }
  ]);

  const [errors, setErrors] = useState<string[]>([]);

  // --- EFFECT: POPULATE FORM ON EDIT ---
  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.revenue_name);
      setSource(itemToEdit.source);
      setAmount(itemToEdit.initial_amount.toString());
      setStartMonth(itemToEdit.start_month.toString());
      setEndMonth(itemToEdit.end_month ? itemToEdit.end_month.toString() : '');
      setFreq(itemToEdit.frequency);

      if ((itemToEdit as any).phases && (itemToEdit as any).phases.length > 0) {
        const rootStart = Number(itemToEdit.start_month) || 1;
        setPhases((itemToEdit as any).phases.map((p: any, idx: number, arr: any[]) => {
          const absMonth = p.trigger_month !== undefined && p.trigger_month !== null ? Number(p.trigger_month) : null;
          let offsetVal = 0;
          if (idx > 0 && absMonth !== null) {
            const prevAbs = idx === 1 ? rootStart : (Number(arr[idx - 1].trigger_month) || rootStart);
            offsetVal = absMonth - prevAbs;
          }
          
          const hasThreshold = p.trigger_threshold !== undefined && p.trigger_threshold !== null && p.trigger_threshold !== '';
          const hasOperator = p.trigger_operator && p.trigger_operator !== '';
          const phaseStrategy = (hasThreshold || hasOperator) ? 'value_based' : 'time_based';

          let metricBasis = 'monthly';
          let compOp = 'greater_than';
          if (p.trigger_operator) {
            if (p.trigger_operator.includes('ytd_revenue_')) {
              metricBasis = 'ytd';
            }
            if (p.trigger_operator.includes('less_than')) {
              compOp = 'less_than';
            } else if (p.trigger_operator.includes('greater_than')) {
              compOp = 'greater_than';
            }
          }

          return {
            id: p.id,
            phase_sequence: p.phase_sequence,
            trigger_strategy: phaseStrategy,
            trigger_month: absMonth,
            trigger_offset: idx > 0 ? offsetVal : "",
            trigger_threshold: hasThreshold ? String(p.trigger_threshold) : '',
            trigger_metric_basis: metricBasis,
            trigger_comparison_operator: compOp,
            growth_rate_percent: (p.growth_rate_percent !== null && p.growth_rate_percent !== undefined) ? parseFloat(p.growth_rate_percent).toFixed(2) : '0.00',
            cost_of_revenue_percent: p.cost_of_revenue_percent ? String(p.cost_of_revenue_percent) : '',
            pct_of_revenue: p.pct_of_revenue ? String(p.pct_of_revenue) : '',
            baseline_increment: (p.baseline_increment !== null && p.baseline_increment !== undefined) ? String(p.baseline_increment) : '',
            is_fixed_stream: !p.volatility_configs || p.volatility_configs.length === 0,
            volatility_configs: p.volatility_configs?.map((c: any) => {
              const clamped = { ...c };
              ['vol_min', 'vol_max', 'target_mean', 'std_dev'].forEach(key => {
                if (clamped[key] !== null && clamped[key] !== undefined && clamped[key] !== '') {
                  clamped[key] = parseFloat(clamped[key]).toFixed(2);
                }
              });
              return clamped;
            }) || []
          };
        }));
      } else {
        // Fallback if no phases exist on the edited item
        setPhases([
          {
            phase_sequence: 1,
            trigger_strategy: 'time_based',
            trigger_month: null,
            trigger_offset: '',
            trigger_threshold: '',
            trigger_metric_basis: 'monthly',
            trigger_comparison_operator: 'greater_than',
            growth_rate_percent: '0.00',
            cost_of_revenue_percent: '',
            pct_of_revenue: '',
            baseline_increment: '',
            is_fixed_stream: false,
            volatility_configs: []
          }
        ]);
      }
    } else {
      clearForm();
    }
  }, [itemToEdit]);

  const clearForm = () => {
    setName('');
    setSource('sales');
    setAmount('');
    setStartMonth('1');
    setEndMonth('');
    setFreq('monthly');
    setPhases([
      {
        phase_sequence: 1,
        trigger_strategy: 'time_based',
        trigger_month: null,
        trigger_offset: '',
        trigger_threshold: '',
        trigger_metric_basis: 'monthly',
        trigger_comparison_operator: 'greater_than',
        growth_rate_percent: '0.00',
        cost_of_revenue_percent: '',
        pct_of_revenue: '',
        baseline_increment: '',
        is_fixed_stream: false,
        volatility_configs: []
      }
    ]);
    setErrors([]);
  };

  const handleAddPhase = () => {
    if (phases.length >= 6) return;
    setPhases(prev => [
      ...prev,
      {
        phase_sequence: prev.length + 1,
        trigger_strategy: 'time_based',
        trigger_month: null,
        trigger_offset: '',
        trigger_threshold: '',
        trigger_metric_basis: 'monthly',
        trigger_comparison_operator: 'greater_than',
        growth_rate_percent: '0.00',
        cost_of_revenue_percent: '',
        baseline_increment: '',
        is_fixed_stream: false,
        volatility_configs: []
      }
    ]);
  };

  const handleRemovePhase = (indexToRemove: number) => {
    const updated = phases
      .filter((_, idx) => idx !== indexToRemove)
      .map((phase, idx) => ({
        ...phase,
        phase_sequence: idx + 1
      }));
    setPhases(updated);
  };

  const handlePhaseFieldChange = (index: number, field: string, value: any) => {
    setPhases(prev => prev.map((p, i) => {
      if (i === index) {
        return { ...p, [field]: value === '' ? null : value };
      }
      return p;
    }));
  };

  const handleTimeFieldChange = (index: number, field: 'trigger_month' | 'trigger_offset', value: string) => {
    const numVal = value === '' ? 0 : Number(value);
    setPhases(prev => {
      const updated = [...prev];
      const rootStart = Number(startMonth) || 1;
      
      updated[index] = { ...updated[index], [field]: value === '' ? '' : numVal };
      
      for (let i = 1; i < updated.length; i++) {
        const prevAbs = i === 1 ? rootStart : (Number(updated[i - 1].trigger_month) || rootStart);
        if (i === index) {
          if (field === 'trigger_month') {
            const abs = value === '' ? prevAbs : numVal;
            updated[i].trigger_month = value === '' ? null : abs;
            updated[i].trigger_offset = value === '' ? 0 : abs - prevAbs;
          } else {
            const offset = value === '' ? 0 : numVal;
            updated[i].trigger_offset = value === '' ? '' : offset;
            updated[i].trigger_month = prevAbs + offset;
          }
        } else if (i > index) {
          const currentOffset = Number(updated[i].trigger_offset) || 0;
          updated[i].trigger_month = prevAbs + currentOffset;
        }
      }
      return updated;
    });
  };

  const handleStartMonthChange = (val: string) => {
    setStartMonth(val);
    const rootStart = val === '' ? 1 : Number(val);
    if (isNaN(rootStart)) return;
    setPhases(prev => {
      const updated = [...prev];
      for (let i = 1; i < updated.length; i++) {
        const prevAbs = i === 1 ? rootStart : (Number(updated[i - 1].trigger_month) || rootStart);
        const currentOffset = Number(updated[i].trigger_offset) || 0;
        updated[i].trigger_month = prevAbs + currentOffset;
      }
      return updated;
    });
  };

  const handlePhaseConfigsChange = (index: number, updatedConfigs: VolatilityConfig[]) => {
    const updated = [...phases];
    updated[index] = {
      ...updated[index],
      volatility_configs: updatedConfigs
    };
    setPhases(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const newErrors = [];
    if (!name.trim()) newErrors.push("Name is required");
    if (!amount || isNaN(Number(amount))) newErrors.push("Valid initial amount is required");
    if (!startMonth || isNaN(Number(startMonth))) newErrors.push("Start month is required");

    phases.forEach((phase, idx) => {
      if (phase.trigger_strategy === 'time_based' && idx > 0) {
        if (phase.trigger_month === null || phase.trigger_month === undefined || phase.trigger_month === '' || isNaN(Number(phase.trigger_month))) {
          newErrors.push(`Phase ${idx + 1}: Valid trigger month is required for time-based strategy.`);
        }
      } else if (phase.trigger_strategy === 'value_based') {
        if (!phase.trigger_comparison_operator) {
          newErrors.push(`Phase ${idx + 1}: Comparison operator is required for value-based strategy.`);
        }
        if (phase.trigger_threshold === null || phase.trigger_threshold === undefined || phase.trigger_threshold === '' || isNaN(Number(phase.trigger_threshold))) {
          newErrors.push(`Phase ${idx + 1}: Valid trigger threshold is required for value-based strategy.`);
        }
      }
    });

    // Strict validation guardrail: cannot submit with empty volatility configs in any phase unless fixed stream is selected
    phases.forEach((phase, idx) => {
      if (!phase.is_fixed_stream) {
        if (!phase.volatility_configs || phase.volatility_configs.length === 0) {
          newErrors.push(`Phase ${idx + 1} Validation Error: The simulation engine requires a financial stream to have an active variance profile. Please enable at least one volatility force (Compounding Growth and/or Transient Operational Noise) before saving this item.`);
        }
        if (phase.volatility_configs && phase.volatility_configs.some((c: any) => !c.volatility_type)) {
          newErrors.push(`Phase ${idx + 1}: Please select a distribution type for all enabled volatility models.`);
        }
      }
    });

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      // Map across all active phases to cleanly format parameters per-phase
      const formattedPhases = phases.map((phase, idx) => {
        const activeConfigs = phase.is_fixed_stream ? [] : (phase.volatility_configs || []);
        const compGrowth = activeConfigs.find((c: any) => c.mode_name === 'compounding_growth');
        let rootGrowth = '0.00';
        if (compGrowth) {
          if (compGrowth.volatility_type === 'flat' && compGrowth.vol_min && compGrowth.vol_max) {
            rootGrowth = parseFloat(String((parseFloat(compGrowth.vol_min) + parseFloat(compGrowth.vol_max)) / 2)).toFixed(2);
          } else if (compGrowth.target_mean) {
            rootGrowth = parseFloat(compGrowth.target_mean).toFixed(2);
          }
        }

        const cleanConfigs = activeConfigs.map((c: any) => {
          const cleaned: any = { ...c };
          Object.keys(cleaned).forEach(key => {
            if (cleaned[key] === '') {
              cleaned[key] = null;
            } else if (['vol_min', 'vol_max', 'target_mean', 'std_dev'].includes(key) && cleaned[key] !== null) {
              cleaned[key] = parseFloat(cleaned[key]).toFixed(2);
            }
          });
          return cleaned;
        });

        const isTimeBased = phase.trigger_strategy === 'time_based';
        const isValueBased = phase.trigger_strategy === 'value_based';

        // Cast threshold value to a strict decimal string with two decimal places
        let formattedThreshold = null;
        if (isValueBased && phase.trigger_threshold !== null && phase.trigger_threshold !== undefined && phase.trigger_threshold !== '') {
          const parsed = parseFloat(phase.trigger_threshold);
          if (!isNaN(parsed)) {
            formattedThreshold = parsed.toFixed(2);
          }
        }

        let finalOperator = null;
        if (isValueBased && phase.trigger_comparison_operator) {
          finalOperator = (phase.trigger_metric_basis === 'ytd' ? 'ytd_revenue_' : '') + phase.trigger_comparison_operator.toLowerCase();
        }

        let formattedIncrement = null;
        if (phase.baseline_increment !== null && phase.baseline_increment !== undefined && phase.baseline_increment !== '') {
          const parsedInc = parseFloat(phase.baseline_increment);
          if (!isNaN(parsedInc)) {
            formattedIncrement = parsedInc.toFixed(2);
          }
        }

        return {
          id: phase.id,
          phase_sequence: phase.phase_sequence,
          // Enforce strict null constraints based on selected strategy
          trigger_month: (isTimeBased && idx > 0) ? (phase.trigger_month !== null && phase.trigger_month !== '' ? Number(phase.trigger_month) : null) : null,
          trigger_threshold: isValueBased ? formattedThreshold : null,
          trigger_operator: finalOperator,
          trigger_offset: null, // Explicitly null for clean payload
          growth_rate_percent: rootGrowth,
          cost_of_revenue_percent: phase.cost_of_revenue_percent ? String(phase.cost_of_revenue_percent) : null,
          baseline_increment: formattedIncrement,
          volatility_configs: cleanConfigs
        };
      });

      const rootTriggerStrategy = phases.some(p => p.trigger_strategy === 'value_based') ? 'value_based' : 'time_based';

      const payload = {
        plan_id: planId,
        revenue_name: name,
        source: source.toLowerCase(),
        initial_amount: String(amount),
        start_month: Number(startMonth),
        end_month: endMonth ? Number(endMonth) : null,
        frequency: freq.toLowerCase(),
        trigger_strategy: rootTriggerStrategy,
        phases: formattedPhases
      };

      if (itemToEdit) {
        await api.updateRevenueItem(itemToEdit.id, payload as any);
      } else {
        await api.createRevenueItem(payload as any);
      }

      clearForm();
      onSuccess(); 
    } catch (err: any) {
      console.error(err);
      const status = err.response?.status;
      const errMsg = err.response?.data?.message || err.message || '';
      if (status === 400) {
        setErrors([errMsg || "Validation Error: Please check your inputs. Ensure all required distribution fields are valid."]);
      } else {
        setErrors([errMsg || "Failed to save item. Please check your inputs."]);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-gray-50 p-5 rounded border shadow-sm">
      <div className="flex justify-between items-center mb-1">
         <h3 className="font-bold text-gray-800 text-lg">{itemToEdit ? 'Edit Revenue Stream' : 'Add Revenue Stream'}</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">* = Required Field. (Model uses Cash Basis accounting)</p>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative text-sm space-y-1">
          <strong className="font-bold block">Validation Errors:</strong>
          <ul className="list-disc pl-5 space-y-1">
            {errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Root Stream Parameters */}
      <div className="bg-white p-4 rounded border space-y-4">
        <h4 className="font-semibold text-sm text-gray-700 border-b pb-2">Stream Configuration</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 font-medium">Name *</label>
            <input className="w-full border p-2 rounded text-sm" placeholder="e.g. SaaS Subs" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Source Type</label>
            <select className="w-full border p-2 rounded text-sm" value={source} onChange={e => setSource(e.target.value)}>
              <option value="sales">Sales</option>
              <option value="subscription">Subscription</option>
              <option value="service">Service</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 flex items-center gap-1 font-medium">
              Initial Monthly Amount ({currencySymbol}) *
              <Tooltip content="Initial amount of monthly revenue in Starting Month" />
            </label>
            <input type="number" className="w-full border p-2 rounded text-sm" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Frequency of Volatility</label>
            <select className="w-full border p-2 rounded text-sm" value={freq} onChange={e => setFreq(e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="one-time">One-time</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 font-medium">Start Month *</label>
            <input type="number" className="w-full border p-2 rounded text-sm" value={startMonth} onChange={e => handleStartMonthChange(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">End Month</label>
            <input type="number" className="w-full border p-2 rounded text-sm" placeholder="Optional" value={endMonth} onChange={e => setEndMonth(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Progressive Multi-Phase UI View */}
      <div className="space-y-4">
        {phases.map((phase, index) => {
          const isFirst = index === 0;
          
          let phaseSummary = '';
          if (isFirst) {
            phaseSummary = '(Baseline)';
          } else {
            if (phase.trigger_strategy === 'time_based') {
              if (phase.trigger_month) {
                phaseSummary = `(Month ${phase.trigger_month})`;
              }
            } else if (phase.trigger_strategy === 'value_based') {
              if (phase.trigger_threshold) {
                const opSymbol = getOperatorSymbol(phase.trigger_comparison_operator);
                const isYtd = phase.trigger_metric_basis === 'ytd';
                const prefix = isYtd ? 'YTD ' : '';
                const formattedThreshold = Number(phase.trigger_threshold).toLocaleString(undefined, { maximumFractionDigits: 0 });
                phaseSummary = `(${prefix}${opSymbol} ${currencySymbol}${formattedThreshold})`;
              }
            }
          }

          return (
          <div key={index} className="space-y-4">
            <div className="border border-gray-200 rounded p-4 bg-white space-y-4 shadow-sm">
              <div className="flex justify-between items-center border-b pb-2">
                <h4 className="font-bold text-sm text-gray-700">Phase {phase.phase_sequence} {phaseSummary}</h4>
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => handleRemovePhase(index)}
                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    Remove Phase
                  </button>
                )}
              </div>

              {/* Trigger Strategy Selection for EVERY phase */}
              <div className="bg-blue-50 border border-blue-200 p-3 rounded space-y-2 mb-4">
                <label className="text-xs font-bold text-blue-800 flex items-center gap-1">
                  Trigger Strategy
                  <Tooltip content="Select how this phase is triggered (by month or by a financial threshold)." />
                </label>
                <select
                  className="w-full border border-blue-300 p-2 rounded text-sm bg-white"
                  value={phase.trigger_strategy || 'time_based'}
                  onChange={e => handlePhaseFieldChange(index, 'trigger_strategy', e.target.value)}
                >
                  <option value="time_based">Time-Based (Month Count)</option>
                  <option value="value_based">Value-Based (Threshold Operator)</option>
                </select>
              </div>

              {/* Trigger Settings based on selected strategy */}
              <div className="bg-gray-50 p-3 rounded border space-y-3">
                <p className="text-xs font-semibold text-gray-600">Phase Trigger Condition</p>
                
                {phase.trigger_strategy === 'time_based' && index === 0 && (
                  <p className="text-xs text-gray-500 italic">Phase 1 begins at the root Start Month.</p>
                )}

                {phase.trigger_strategy === 'time_based' && index > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1 font-medium">enter the absolute month *</label>
                      <input
                        type="number"
                        className="w-full border p-2 rounded text-sm bg-white"
                        placeholder="e.g. 12"
                        value={phase.trigger_month ?? ''}
                        onChange={e => handleTimeFieldChange(index, 'trigger_month', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1 font-medium">the offset in months vs the previous phase, and I'll calculate the absolute month *</label>
                      <input
                        type="number"
                        className="w-full border p-2 rounded text-sm bg-white"
                        placeholder="e.g. 6"
                        value={phase.trigger_offset ?? ''}
                        onChange={e => handleTimeFieldChange(index, 'trigger_offset', e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {phase.trigger_strategy === 'value_based' && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1 font-medium">Metric Basis *</label>
                      <select
                        className="w-full border p-2 rounded text-sm bg-white"
                        value={phase.trigger_metric_basis || 'monthly'}
                        onChange={e => handlePhaseFieldChange(index, 'trigger_metric_basis', e.target.value)}
                      >
                        <option value="monthly">Monthly Revenue</option>
                        <option value="ytd">Calendar YTD Revenue</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1 font-medium">Comparison Operator *</label>
                      <select
                        className="w-full border p-2 rounded text-sm bg-white"
                        value={phase.trigger_comparison_operator || 'greater_than'}
                        onChange={e => handlePhaseFieldChange(index, 'trigger_comparison_operator', e.target.value)}
                      >
                        <option value="greater_than">Greater than (&gt;)</option>
                        <option value="less_than">Less than (&lt;)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1 font-medium">Threshold Amount ({currencySymbol}) *</label>
                      <input
                        type="number"
                        step="any"
                        className="w-full border p-2 rounded text-sm bg-white"
                        placeholder="e.g. 50000.00"
                        value={phase.trigger_threshold || ''}
                        onChange={e => handlePhaseFieldChange(index, 'trigger_threshold', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Growth & Cost Parameters */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 flex items-center gap-1 font-medium">
                    Cost of Rev (%)
                    <Tooltip content="Cost of revenue percentage for this specific phase." />
                  </label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded text-sm"
                    placeholder="Optional"
                    value={phase.cost_of_revenue_percent || ''}
                    onChange={e => handlePhaseFieldChange(index, 'cost_of_revenue_percent', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 flex items-center gap-1 font-medium">
                    Baseline Increment / Structural Jump
                    <Tooltip content="Optional fixed amount to add or subtract from the baseline when this phase triggers." />
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="w-full border p-2 rounded text-sm"
                    placeholder="e.g. 5000.00 or -1500.00"
                    value={phase.baseline_increment || ''}
                    onChange={e => handlePhaseFieldChange(index, 'baseline_increment', e.target.value)}
                  />
                </div>
              </div>

              {/* Volatility Inputs for this Phase */}
              <div className="mt-4 space-y-4">
                <div className="flex items-start gap-2 bg-gray-50 p-3 rounded border">
                  <input
                    type="checkbox"
                    id={`fixed-stream-rev-${index}`}
                    checked={phase.is_fixed_stream || false}
                    onChange={e => handlePhaseFieldChange(index, 'is_fixed_stream', e.target.checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <label htmlFor={`fixed-stream-rev-${index}`} className="text-sm font-bold text-gray-700 cursor-pointer">
                      Fixed Stream (No Volatility)
                    </label>
                    <p className="text-xs text-gray-500">
                      Only choose this if you are certain that there cannot be any volatility.
                    </p>
                  </div>
                </div>

                {!phase.is_fixed_stream && (
                  <VolatilityInputs
                    configs={phase.volatility_configs}
                    onChange={(updated) => handlePhaseConfigsChange(index, updated)}
                  />
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* Action Button Layout */}
      <div className="mt-4">
        {phases.length < 6 ? (
          <button
            type="button"
            onClick={handleAddPhase}
            className="w-full py-2 px-4 border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 rounded text-sm font-medium transition-colors"
          >
            + Do you want to add another phase?
          </button>
        ) : (
          <div className="w-full py-2 px-4 bg-gray-100 border border-gray-300 text-gray-500 rounded text-sm text-center font-medium">
            You have reached the maximum of six phases
          </div>
        )}
      </div>

      <div className="flex gap-4 pt-4 border-t">
        {itemToEdit && (
          <button 
            type="button" 
            onClick={onCancel} 
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded flex-1 transition-colors"
          >
            Cancel Edit
          </button>
        )}
        <button 
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded flex-1 transition-colors"
        >
          {itemToEdit ? 'Update Stream' : 'Add Stream'}
        </button>
      </div>
    </form>
  );
}
