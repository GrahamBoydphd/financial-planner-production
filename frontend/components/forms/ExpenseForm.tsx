'use client';

import { useState, useEffect } from 'react';
import { api, ExpenseItem } from '@/lib/api';
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
  itemToEdit?: ExpenseItem | null;
  onCancel?: () => void;
  currencySymbol?: string;
}

export default function ExpenseForm({ planId, onSuccess, itemToEdit, onCancel, currencySymbol = '$' }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('opex');
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
      pct_of_revenue: '',
      baseline_increment: '',
      is_fixed_stream: false,
      volatility_configs: []
    }
  ]);

  const [errors, setErrors] = useState<string[]>([]);

  // --- POPULATE ON EDIT ---
  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.expense_name);
      setCategory(itemToEdit.category);
      setAmount(itemToEdit.initial_amount.toString());
      setStartMonth(itemToEdit.start_month.toString());
      setEndMonth(itemToEdit.end_month ? itemToEdit.end_month.toString() : '');
      setFreq(itemToEdit.frequency);
      
      const editItem = itemToEdit as any;

      if (editItem.phases && editItem.phases.length > 0) {
        const rootStart = Number(itemToEdit.start_month) || 1;
        setPhases(editItem.phases.map((p: any, idx: number, arr: any[]) => {
          const absMonth = p.trigger_month !== undefined && p.trigger_month !== null ? Number(p.trigger_month) : null;
          let offsetVal = 0;
          if (idx > 0 && absMonth !== null) {
            const prevAbs = idx === 1 ? rootStart : (Number(arr[idx - 1].trigger_month) || rootStart);
            offsetVal = absMonth - prevAbs;
          }
          
          const hasValueTrigger = (p.trigger_threshold !== undefined && p.trigger_threshold !== null) || (p.trigger_operator && p.trigger_operator !== '');
          
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
            trigger_strategy: hasValueTrigger ? 'value_based' : 'time_based',
            trigger_month: absMonth,
            trigger_offset: idx > 0 ? offsetVal : "",
            trigger_threshold: p.trigger_threshold !== undefined && p.trigger_threshold !== null ? String(p.trigger_threshold) : '',
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
        // Fallback if legacy item has no phases
        setPhases([
          {
            phase_sequence: 1,
            trigger_strategy: 'time_based',
            trigger_month: null,
            trigger_offset: '',
            trigger_threshold: '',
            trigger_metric_basis: 'monthly',
            trigger_comparison_operator: 'greater_than',
            growth_rate_percent: (editItem.growth_rate_percent !== null && editItem.growth_rate_percent !== undefined) ? parseFloat(editItem.growth_rate_percent).toFixed(2) : '0.00',
            cost_of_revenue_percent: '',
            pct_of_revenue: editItem.pct_of_revenue ? editItem.pct_of_revenue.toString() : '',
            baseline_increment: '',
            is_fixed_stream: !editItem.volatility_configs || editItem.volatility_configs.length === 0,
            volatility_configs: editItem.volatility_configs?.map((c: any) => {
              const clamped = { ...c };
              ['vol_min', 'vol_max', 'target_mean', 'std_dev'].forEach(key => {
                if (clamped[key] !== null && clamped[key] !== undefined && clamped[key] !== '') {
                  clamped[key] = parseFloat(clamped[key]).toFixed(2);
                }
              });
              return clamped;
            }) || []
          }
        ]);
      }
    } else {
      clearForm();
    }
  }, [itemToEdit]);

  const clearForm = () => {
    setName('');
    setCategory('opex');
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
    setPhases(prev => prev.map((p, idx) => {
      if (idx === index) {
        return { ...p, volatility_configs: updatedConfigs };
      }
      return p;
    }));
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
        pct_of_revenue: '',
        baseline_increment: '',
        is_fixed_stream: false,
        volatility_configs: []
      }
    ]);
  };

  const handleRemovePhase = (index: number) => {
    setPhases(prev => {
      const filtered = prev.filter((_, idx) => idx !== index);
      return filtered.map((p, idx) => ({
        ...p,
        phase_sequence: idx + 1
      }));
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const newErrors: string[] = [];
    if (!name.trim()) newErrors.push("Name is required");
    if (!amount || isNaN(Number(amount))) newErrors.push("Valid initial amount is required");
    if (!startMonth || isNaN(Number(startMonth))) newErrors.push("Start month is required");

    // Validate each phase
    phases.forEach((phase, idx) => {
      const phaseNum = idx + 1;
      if (!phase.is_fixed_stream) {
        if (!phase.volatility_configs || phase.volatility_configs.length === 0) {
          newErrors.push(`Validation Error (Phase ${phaseNum}): The simulation engine requires a financial stream to have an active variance profile. Please enable at least one volatility force (Compounding Growth and/or Transient Operational Noise) before saving this item.`);
        }
        if (phase.volatility_configs && phase.volatility_configs.some((c: any) => !c.volatility_type)) {
          newErrors.push(`Please select a distribution type for all enabled volatility models in Phase ${phaseNum}.`);
        }
      }
      
      if (phase.trigger_strategy === 'time_based' && idx > 0) {
        if (phase.trigger_month === null || phase.trigger_month === undefined || phase.trigger_month === '') {
          newErrors.push(`Phase ${phaseNum} requires a trigger month.`);
        }
      } else if (phase.trigger_strategy === 'value_based') {
        if (!phase.trigger_comparison_operator) {
          newErrors.push(`Phase ${phaseNum} requires a comparison operator.`);
        }
        if (phase.trigger_threshold === null || phase.trigger_threshold === undefined || phase.trigger_threshold === '' || isNaN(Number(phase.trigger_threshold))) {
          newErrors.push(`Phase ${phaseNum} requires a valid trigger threshold.`);
        }
      }
    });

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const processedPhases = phases.map((phase, idx) => {
        const activeConfigs = phase.is_fixed_stream ? [] : (phase.volatility_configs || []);
        // Find compounding growth block inside each phase's volatility configs
        const compGrowth = activeConfigs.find((c: any) => c.mode_name === 'compounding_growth');
        let localGrowth = '0.00';
        if (compGrowth) {
          if (compGrowth.volatility_type === 'flat' && compGrowth.vol_min && compGrowth.vol_max) {
            localGrowth = parseFloat(String((parseFloat(compGrowth.vol_min) + parseFloat(compGrowth.vol_max)) / 2)).toFixed(2);
          } else if (compGrowth.target_mean) {
            localGrowth = parseFloat(compGrowth.target_mean).toFixed(2);
          }
        }

        // Safely scrub empty text strings to null and clamp variance percentages
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

        const isValueBased = phase.trigger_strategy === 'value_based';
        const composedOperator = phase.trigger_metric_basis === 'ytd' 
          ? `ytd_revenue_${phase.trigger_comparison_operator}` 
          : phase.trigger_comparison_operator;

        let formattedIncrement = null;
        if (phase.baseline_increment !== null && phase.baseline_increment !== undefined && phase.baseline_increment !== '') {
          const parsedInc = parseFloat(phase.baseline_increment);
          if (!isNaN(parsedInc)) {
            formattedIncrement = parsedInc.toFixed(2);
          }
        }

        return {
          id: phase.id, // Retain ID for safe backend updates
          phase_sequence: idx + 1,
          trigger_month: (!isValueBased && idx > 0) ? (phase.trigger_month !== null && phase.trigger_month !== '' ? Number(phase.trigger_month) : null) : null,
          trigger_threshold: isValueBased ? (phase.trigger_threshold !== null && phase.trigger_threshold !== '' ? parseFloat(phase.trigger_threshold).toFixed(2) : null) : null,
          trigger_operator: isValueBased ? (composedOperator ? String(composedOperator).toLowerCase() : null) : null,
          growth_rate_percent: localGrowth,
          pct_of_revenue: phase.pct_of_revenue ? String(phase.pct_of_revenue) : null,
          baseline_increment: formattedIncrement,
          volatility_configs: cleanConfigs
        };
      });

      const parentTriggerStrategy = phases.some(p => p.trigger_strategy === 'value_based') ? 'value_based' : 'time_based';

      const payload = {
        plan_id: planId,
        expense_name: name,
        category: category,
        initial_amount: String(amount),
        start_month: Number(startMonth),
        end_month: endMonth ? Number(endMonth) : undefined,
        frequency: freq.toLowerCase(),
        trigger_strategy: parentTriggerStrategy,
        phases: processedPhases
      };

      if (itemToEdit) {
        await api.updateExpenseItem(itemToEdit.id, payload as any);
      } else {
        await api.createExpenseItem(payload as any);
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
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-4 rounded border">
      <div className="flex justify-between items-center mb-1">
         <h3 className="font-bold text-gray-700">{itemToEdit ? 'Edit Expense' : 'Add Expense'}</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">* = Required Field. (Model uses Cash Basis accounting)</p>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative text-sm">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{errors.join(", ")}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500">Name *</label>
          <input className="w-full border p-2 rounded text-sm" placeholder="e.g. Salaries" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Category</label>
          <select className="w-full border p-2 rounded text-sm" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="opex">OpEx</option>
            <option value="capex">CapEx</option>
            <option value="payroll">Payroll</option>
            <option value="marketing">Marketing</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="text-xs text-gray-500 flex items-center gap-1">
            Initial Monthly Amount ({currencySymbol}) *
            <Tooltip content="Initial amount of monthly expense in Starting Month" />
          </label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500">Frequency of Volatility</label>
          <select className="w-full border p-2 rounded text-sm" value={freq} onChange={e => setFreq(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="one-time">One-time</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Start Month *</label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={startMonth} onChange={e => handleStartMonthChange(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">End Month</label>
          <input type="number" className="w-full border p-2 rounded text-sm" placeholder="Optional" value={endMonth} onChange={e => setEndMonth(e.target.value)} />
        </div>
      </div>

      {/* PROGRESSIVE MULTI-PHASE UI VIEW */}
      <div className="space-y-6 my-4">
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
            <div key={index} className="space-y-6">
              <div className="border border-gray-200 rounded p-4 bg-white shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-bold text-sm text-gray-800">Phase {index + 1} {phaseSummary}</h4>
                  {!isFirst && (
                    <button
                      type="button"
                      onClick={() => handleRemovePhase(index)}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold"
                    >
                      Remove Phase
                    </button>
                  )}
                </div>

                {/* Trigger Conditions Block */}
                <div className="bg-gray-50 p-3 rounded border border-dashed space-y-3">
                  <p className="text-xs font-semibold text-gray-600">Trigger Conditions</p>
                  
                  <div className="mb-3">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Trigger Strategy *</label>
                    <select
                      className="w-full border p-2 rounded text-sm bg-white"
                      value={phase.trigger_strategy || 'time_based'}
                      onChange={e => handlePhaseFieldChange(index, 'trigger_strategy', e.target.value)}
                    >
                      <option value="time_based">Time-based</option>
                      <option value="value_based">Value-based</option>
                    </select>
                  </div>

                  {phase.trigger_strategy === 'time_based' && (
                    isFirst ? (
                      <p className="text-xs text-gray-500 italic">Activation uses the root Start Month.</p>
                    ) : (
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
                    )
                  )}

                  {phase.trigger_strategy === 'value_based' && (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Metric Basis *</label>
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
                        <label className="text-xs text-gray-500 block mb-1">Comparison Operator *</label>
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
                        <label className="text-xs text-gray-500 block mb-1">Threshold Amount ({currencySymbol}) *</label>
                        <input
                          type="number"
                          step="any"
                          className="w-full border p-2 rounded text-sm bg-white"
                          placeholder="e.g. 100000"
                          value={phase.trigger_threshold || ''}
                          onChange={e => handlePhaseFieldChange(index, 'trigger_threshold', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Growth Parameters */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 flex items-center gap-1">
                      % of Revenue
                      <Tooltip content="Percentage of revenue tied to expense in this phase." />
                    </label>
                    <input
                      type="number"
                      className="w-full border p-2 rounded text-sm"
                      placeholder="Optional"
                      value={phase.pct_of_revenue ?? ''}
                      onChange={e => handlePhaseFieldChange(index, 'pct_of_revenue', e.target.value)}
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

                {/* Dedicated Phase Volatility Inputs */}
                <div className="mt-4 space-y-4">
                  <div className="flex items-start gap-2 bg-gray-50 p-3 rounded border">
                    <input
                      type="checkbox"
                      id={`fixed-stream-exp-${index}`}
                      checked={phase.is_fixed_stream || false}
                      onChange={e => handlePhaseFieldChange(index, 'is_fixed_stream', e.target.checked)}
                      className="mt-0.5"
                    />
                    <div>
                      <label htmlFor={`fixed-stream-exp-${index}`} className="text-sm font-bold text-gray-700 cursor-pointer">
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
      <div className="my-4">
        {phases.length < 6 ? (
          <button
            type="button"
            onClick={handleAddPhase}
            className="w-full py-2 px-4 border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 rounded text-sm font-semibold transition-colors"
          >
            + Do you want to add another phase?
          </button>
        ) : (
          <div className="w-full py-2 px-4 bg-gray-100 border border-gray-300 text-gray-500 rounded text-sm text-center font-semibold">
            You have reached the maximum of six phases
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {itemToEdit && (
            <button 
                type="button" 
                onClick={onCancel} 
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded flex-1"
            >
                Cancel Edit
            </button>
        )}
        <button 
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded flex-1"
        >
            {itemToEdit ? 'Update Expense' : 'Add Expense'}
        </button>
      </div>
    </form>
  );
}
