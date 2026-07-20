'use client';

import { useState, useEffect } from 'react';
import { api, ExpenseItem } from '@/lib/api';
import Tooltip from '@/components/ui/Tooltip';
import VolatilityInputs, { VolatilityConfig } from '@/components/forms/shared/VolatilityInputs';

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

  // Global Trigger Strategy State
  const [triggerStrategy, setTriggerStrategy] = useState<string | null>(null);

  // Ordered Phase Array State
  const [phases, setPhases] = useState<any[]>([
    {
      phase_sequence: 1,
      trigger_month: null,
      trigger_offset: '',
      trigger_threshold: '',
      trigger_operator: '',
      growth_rate_percent: '0.0',
      pct_of_revenue: '',
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
      const triggerStrat = editItem.trigger_strategy || editItem.triggerStrategy || null;
      setTriggerStrategy(triggerStrat);

      if (editItem.phases && editItem.phases.length > 0) {
        const rootStart = Number(itemToEdit.start_month) || 1;
        setPhases(editItem.phases.map((p: any, idx: number, arr: any[]) => {
          const absMonth = p.trigger_month !== undefined && p.trigger_month !== null ? Number(p.trigger_month) : null;
          let offsetVal = 0;
          if (idx > 0 && absMonth !== null) {
            const prevAbs = idx === 1 ? rootStart : (Number(arr[idx - 1].trigger_month) || rootStart);
            offsetVal = absMonth - prevAbs;
          }
          return {
            id: p.id,
            phase_sequence: p.phase_sequence,
            trigger_month: absMonth,
            trigger_offset: idx > 0 ? offsetVal : "",
            trigger_threshold: p.trigger_threshold !== undefined && p.trigger_threshold !== null ? String(p.trigger_threshold) : '',
            trigger_operator: p.trigger_operator || '',
            growth_rate_percent: String(p.growth_rate_percent || '0.0'),
            cost_of_revenue_percent: p.cost_of_revenue_percent ? String(p.cost_of_revenue_percent) : '',
            pct_of_revenue: p.pct_of_revenue ? String(p.pct_of_revenue) : '',
            volatility_configs: p.volatility_configs || []
          };
        }));
      } else {
        // Fallback if legacy item has no phases
        setPhases([
          {
            phase_sequence: 1,
            trigger_month: null,
            trigger_offset: '',
            trigger_threshold: '',
            trigger_operator: '',
            growth_rate_percent: editItem.growth_rate_percent?.toString() ?? '0.0',
            cost_of_revenue_percent: '',
            pct_of_revenue: editItem.pct_of_revenue ? editItem.pct_of_revenue.toString() : '',
            volatility_configs: editItem.volatility_configs || []
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
    setTriggerStrategy(null);
    setPhases([
      {
        phase_sequence: 1,
        trigger_month: null,
        trigger_offset: '',
        trigger_threshold: '',
        trigger_operator: '',
        growth_rate_percent: '0.0',
        cost_of_revenue_percent: '',
        pct_of_revenue: '',
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
    if (phases.length >= 4) return;
    setPhases(prev => [
      ...prev,
      {
        phase_sequence: prev.length + 1,
        trigger_month: null,
        trigger_offset: '',
        trigger_threshold: '',
        trigger_operator: '',
        growth_rate_percent: '0.0',
        pct_of_revenue: '',
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
      if (!phase.volatility_configs || phase.volatility_configs.length === 0) {
        newErrors.push(`Validation Error (Phase ${phaseNum}): The simulation engine requires a financial stream to have an active variance profile. Please enable at least one volatility force (Compounding Growth and/or Transient Operational Noise) before saving this item.`);
      }
      if (phase.volatility_configs.some((c: any) => !c.volatility_type)) {
        newErrors.push(`Please select a distribution type for all enabled volatility models in Phase ${phaseNum}.`);
      }
      if (idx > 0) {
        if (!triggerStrategy) {
          newErrors.push(`Please select a Global Trigger Strategy for multi-phase configuration.`);
        } else if (triggerStrategy === 'time_based' && (phase.trigger_month === null || phase.trigger_month === undefined || phase.trigger_month === '')) {
          newErrors.push(`Phase ${phaseNum} requires a trigger month.`);
        } else if (triggerStrategy === 'value_based') {
          if (!phase.trigger_operator) {
            newErrors.push(`Phase ${phaseNum} requires a trigger operator.`);
          }
          if (phase.trigger_threshold === null || phase.trigger_threshold === undefined || phase.trigger_threshold === '' || isNaN(Number(phase.trigger_threshold))) {
            newErrors.push(`Phase ${phaseNum} requires a valid trigger threshold.`);
          }
        }
      }
    });

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const processedPhases = phases.map((phase, idx) => {
        // Find compounding growth block inside each phase's volatility configs
        const compGrowth = phase.volatility_configs.find((c: any) => c.mode_name === 'compounding_growth');
        let localGrowth = '0.0';
        if (compGrowth) {
          if (compGrowth.volatility_type === 'flat' && compGrowth.vol_min && compGrowth.vol_max) {
            localGrowth = ((parseFloat(compGrowth.vol_min) + parseFloat(compGrowth.vol_max)) / 2).toString();
          } else if (compGrowth.target_mean) {
            localGrowth = String(compGrowth.target_mean);
          }
        }

        // Safely scrub empty text strings to null
        const cleanConfigs = phase.volatility_configs.map((c: any) => {
          const cleaned: any = { ...c };
          Object.keys(cleaned).forEach(key => {
            if (cleaned[key] === '') {
              cleaned[key] = null;
            }
          });
          return cleaned;
        });

        return {
          id: phase.id, // Retain ID for safe backend updates
          phase_sequence: idx + 1,
          trigger_month: idx > 0 && triggerStrategy === 'time_based' ? (phase.trigger_month !== null && phase.trigger_month !== '' ? Number(phase.trigger_month) : null) : null,
          trigger_threshold: idx > 0 && triggerStrategy === 'value_based' ? (phase.trigger_threshold !== null && phase.trigger_threshold !== '' ? String(phase.trigger_threshold) : null) : null,
          trigger_operator: idx > 0 && triggerStrategy === 'value_based' ? (phase.trigger_operator || null) : null,
          growth_rate_percent: localGrowth,
          pct_of_revenue: phase.pct_of_revenue ? String(phase.pct_of_revenue) : null,
          volatility_configs: cleanConfigs
        };
      });

      const payload = {
        plan_id: planId,
        expense_name: name,
        category: category,
        initial_amount: String(amount),
        start_month: Number(startMonth),
        end_month: endMonth ? Number(endMonth) : undefined,
        frequency: freq.toLowerCase(),
        trigger_strategy: phases.length > 1 ? triggerStrategy : null,
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
            Initial Amount ({currencySymbol}) *
            <Tooltip content="Initial amount of expense in Starting Month" />
          </label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500">Frequency</label>
          <select className="w-full border p-2 rounded text-sm" value={freq} onChange={e => setFreq(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="one_time">One-time</option>
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
          return (
            <div key={index} className="space-y-6">
              <div className="border border-gray-200 rounded p-4 bg-white shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-bold text-sm text-gray-800">Phase {index + 1} {isFirst ? '(Baseline)' : ''}</h4>
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

                {/* Conditional Trigger Settings for Phase 2, 3, 4 */}
                {!isFirst && (
                  <div className="bg-gray-50 p-3 rounded border border-dashed space-y-3">
                    <p className="text-xs font-semibold text-gray-600">Trigger Conditions</p>
                    {triggerStrategy === 'time_based' && (
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
                    {triggerStrategy === 'value_based' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Operator *</label>
                          <select
                            className="w-full border p-2 rounded text-sm bg-white"
                            value={phases[index]?.trigger_operator || ''}
                            onChange={e => handlePhaseFieldChange(index, 'trigger_operator', e.target.value)}
                          >
                            <option value="">-- Select Operator --</option>
                            <option value="greater_than">Greater Than (&gt;)</option>
                            <option value="less_than">Less Than (&lt;)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Threshold Value *</label>
                          <input
                            type="text"
                            className="w-full border p-2 rounded text-sm bg-white"
                            placeholder="e.g. 100000"
                            value={phases[index]?.trigger_threshold || ''}
                            onChange={e => handlePhaseFieldChange(index, 'trigger_threshold', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                    {!triggerStrategy && (
                      <p className="text-xs text-amber-600 italic">Please select a Global Trigger Strategy above to configure this phase's activation trigger.</p>
                    )}
                  </div>
                )}

                {/* Growth Parameters */}
                <div className="grid grid-cols-1 gap-4">
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
                </div>

                {/* Dedicated Phase Volatility Inputs */}
                <VolatilityInputs
                  configs={phase.volatility_configs}
                  onChange={(updated) => handlePhaseConfigsChange(index, updated)}
                />
              </div>

              {/* GLOBAL TRIGGER STRATEGY SELECTION placed explicitly between Phase 1 and Phase 2 */}
              {isFirst && phases.length > 1 && (
                <div className="bg-blue-50 p-3 rounded border border-blue-200 my-4">
                  <label className="block text-xs font-bold text-blue-800 mb-1">Global Trigger Strategy *</label>
                  <select
                    className="w-full border p-2 rounded text-sm bg-white"
                    value={triggerStrategy || ''}
                    onChange={e => setTriggerStrategy(e.target.value || null)}
                  >
                    <option value="">-- Select Trigger Strategy --</option>
                    <option value="time_based">Time-based (Trigger Month)</option>
                    <option value="value_based">Value-based (Monthly Revenue Threshold)</option>
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Button Layout */}
      <div className="my-4">
        {phases.length < 4 ? (
          <button
            type="button"
            onClick={handleAddPhase}
            className="w-full py-2 px-4 border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 rounded text-sm font-semibold transition-colors"
          >
            + Do you want to add another phase?
          </button>
        ) : (
          <div className="w-full py-2 px-4 bg-gray-100 border border-gray-300 text-gray-500 rounded text-sm text-center font-semibold">
            You have reached the maximum of four phases
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
