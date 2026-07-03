'use client';

import { useState, useEffect } from 'react';
import { api, RevenueItem } from '@/lib/api';
import Tooltip from '@/components/ui/Tooltip';
import VolatilityInputs, { VolatilityConfig } from '@/components/forms/shared/VolatilityInputs';

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

  // Global Trigger Strategy State
  const [triggerStrategy, setTriggerStrategy] = useState<string | null>(null);

  // Ordered Phase Array State
  const [phases, setPhases] = useState<any[]>([
    {
      phase_sequence: 1,
      trigger_month: null,
      trigger_threshold: '',
      trigger_operator: '',
      growth_rate_percent: '0.0',
      cost_of_revenue_percent: '',
      pct_of_revenue: '',
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
      
      const triggerStrat = (itemToEdit as any).trigger_strategy || (itemToEdit as any).triggerStrategy || null;
      setTriggerStrategy(triggerStrat);

      if ((itemToEdit as any).phases && (itemToEdit as any).phases.length > 0) {
        setPhases((itemToEdit as any).phases.map((p: any) => ({
          id: p.id,
          phase_sequence: p.phase_sequence,
          trigger_month: p.trigger_month !== undefined && p.trigger_month !== null ? Number(p.trigger_month) : null,
          trigger_threshold: p.trigger_threshold !== undefined && p.trigger_threshold !== null ? String(p.trigger_threshold) : '',
          trigger_operator: p.trigger_operator || '',
          growth_rate_percent: String(p.growth_rate_percent || '0.0'),
          cost_of_revenue_percent: p.cost_of_revenue_percent ? String(p.cost_of_revenue_percent) : '',
          pct_of_revenue: p.pct_of_revenue ? String(p.pct_of_revenue) : '',
          volatility_configs: p.volatility_configs || []
        })));
      } else {
        // Fallback if no phases exist on the edited item
        setPhases([
          {
            phase_sequence: 1,
            trigger_month: null,
            trigger_threshold: '',
            trigger_operator: '',
            growth_rate_percent: '0.0',
            cost_of_revenue_percent: '',
            pct_of_revenue: '',
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
    setTriggerStrategy(null);
    setPhases([
      {
        phase_sequence: 1,
        trigger_month: null,
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

  const handleAddPhase = () => {
    if (phases.length >= 4) return;
    setPhases(prev => [
      ...prev,
      {
        phase_sequence: prev.length + 1,
        trigger_month: null,
        trigger_threshold: '',
        trigger_operator: '',
        growth_rate_percent: '0.0',
        cost_of_revenue_percent: '',
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

    // Multi-phase validation
    if (phases.length > 1) {
      if (!triggerStrategy) {
        newErrors.push("Please select a global Trigger Strategy for multi-phase streams.");
      } else {
        phases.forEach((phase, idx) => {
          if (idx > 0) {
            if (triggerStrategy === 'time_based') {
              if (phase.trigger_month === null || phase.trigger_month === undefined || phase.trigger_month === '' || isNaN(Number(phase.trigger_month))) {
                newErrors.push(`Phase ${idx + 1}: Valid trigger month is required for time-based strategy.`);
              }
            } else if (triggerStrategy === 'value_based') {
              if (!phase.trigger_operator) {
                newErrors.push(`Phase ${idx + 1}: Trigger operator is required for value-based strategy.`);
              }
              if (phase.trigger_threshold === null || phase.trigger_threshold === undefined || phase.trigger_threshold === '' || isNaN(Number(phase.trigger_threshold))) {
                newErrors.push(`Phase ${idx + 1}: Valid trigger threshold is required for value-based strategy.`);
              }
            }
          }
        });
      }
    }

    // Strict validation guardrail: cannot submit with empty volatility configs in any phase
    phases.forEach((phase, idx) => {
      if (!phase.volatility_configs || phase.volatility_configs.length === 0) {
        newErrors.push(`Phase ${idx + 1} Validation Error: The simulation engine requires a financial stream to have an active variance profile. Please enable at least one volatility force (Compounding Growth and/or Transient Operational Noise) before saving this item.`);
      }
      if (phase.volatility_configs.some((c: any) => !c.volatility_type)) {
        newErrors.push(`Phase ${idx + 1}: Please select a distribution type for all enabled volatility models.`);
      }
    });

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      // Map across all active phases to cleanly format parameters per-phase
      const formattedPhases = phases.map((phase, idx) => {
        const compGrowth = phase.volatility_configs.find((c: any) => c.mode_name === 'compounding_growth');
        let rootGrowth = '0.0';
        if (compGrowth) {
          if (compGrowth.volatility_type === 'flat' && compGrowth.vol_min && compGrowth.vol_max) {
            rootGrowth = ((parseFloat(compGrowth.vol_min) + parseFloat(compGrowth.vol_max)) / 2).toString();
          } else if (compGrowth.target_mean) {
            rootGrowth = String(compGrowth.target_mean);
          }
        }

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
          id: phase.id,
          phase_sequence: phase.phase_sequence,
          trigger_month: idx > 0 && triggerStrategy === 'time_based' ? (phase.trigger_month !== null && phase.trigger_month !== '' ? Number(phase.trigger_month) : null) : null,
          trigger_threshold: idx > 0 && triggerStrategy === 'value_based' ? (phase.trigger_threshold !== null && phase.trigger_threshold !== '' ? String(phase.trigger_threshold) : null) : null,
          trigger_operator: idx > 0 && triggerStrategy === 'value_based' ? (phase.trigger_operator || null) : null,
          growth_rate_percent: rootGrowth,
          cost_of_revenue_percent: phase.cost_of_revenue_percent ? String(phase.cost_of_revenue_percent) : null,
          volatility_configs: cleanConfigs
        };
      });

      const payload = {
        plan_id: planId,
        revenue_name: name,
        source: source.toLowerCase(),
        initial_amount: String(amount),
        start_month: Number(startMonth),
        end_month: endMonth ? Number(endMonth) : null,
        frequency: freq.toLowerCase(),
        trigger_strategy: phases.length > 1 ? triggerStrategy : null,
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
              Initial Amount ({currencySymbol}) *
              <Tooltip content="Initial amount of revenue in Starting Month" />
            </label>
            <input type="number" className="w-full border p-2 rounded text-sm" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Frequency</label>
            <select className="w-full border p-2 rounded text-sm" value={freq} onChange={e => setFreq(e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="one_time">One-time</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 font-medium">Start Month *</label>
            <input type="number" className="w-full border p-2 rounded text-sm" value={startMonth} onChange={e => setStartMonth(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">End Month</label>
            <input type="number" className="w-full border p-2 rounded text-sm" placeholder="Optional" value={endMonth} onChange={e => setEndMonth(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Progressive Multi-Phase UI View */}
      <div className="space-y-4">
        {phases.map((phase, index) => (
          <div key={index} className="space-y-4">
            <div className="border border-gray-200 rounded p-4 bg-white space-y-4 shadow-sm">
              <div className="flex justify-between items-center border-b pb-2">
                <h4 className="font-bold text-sm text-gray-700">Phase {phase.phase_sequence} {index === 0 ? '(Baseline)' : ''}</h4>
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

              {/* Trigger Settings for Phase > 1 */}
              {index > 0 && (
                <div className="bg-gray-50 p-3 rounded border space-y-3">
                  <p className="text-xs font-semibold text-gray-600">Phase Trigger Condition</p>
                  {triggerStrategy === 'time_based' && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Trigger Month *</label>
                      <input
                        type="number"
                        className="w-full border p-2 rounded text-sm"
                        placeholder="e.g. 12"
                        value={phases[index]?.trigger_month || ''}
                        onChange={e => handlePhaseFieldChange(index, 'trigger_month', e.target.value ? Number(e.target.value) : null)}
                      />
                    </div>
                  )}
                  {triggerStrategy === 'value_based' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Operator *</label>
                        <select
                          className="w-full border p-2 rounded text-sm"
                          value={phases[index]?.trigger_operator || ''}
                          onChange={e => handlePhaseFieldChange(index, 'trigger_operator', e.target.value)}
                        >
                          <option value="">Select Operator</option>
                          <option value="greater_than">Greater Than (&gt;)</option>
                          <option value="less_than">Less Than (&lt;)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Threshold Value *</label>
                        <input
                          type="text"
                          className="w-full border p-2 rounded text-sm"
                          placeholder="e.g. 50000"
                          value={phases[index]?.trigger_threshold || ''}
                          onChange={e => handlePhaseFieldChange(index, 'trigger_threshold', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  {!triggerStrategy && (
                    <p className="text-xs text-amber-600">Please select a global Trigger Strategy above to configure this phase's trigger.</p>
                  )}
                </div>
              )}

              {/* Growth & Cost Parameters */}
              <div className="grid grid-cols-1 gap-4">
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
              </div>

              {/* Volatility Inputs for this Phase */}
              <VolatilityInputs
                configs={phase.volatility_configs}
                onChange={(updated) => handlePhaseConfigsChange(index, updated)}
              />
            </div>

            {/* Global Trigger Strategy Selection placed explicitly between Phase 1 and Phase 2 */}
            {index === 0 && phases.length > 1 && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded space-y-2 my-4">
                <label className="text-xs font-bold text-blue-800 flex items-center gap-1">
                  Global Trigger Strategy *
                  <Tooltip content="Select how subsequent phases are triggered (by month or by a financial threshold)." />
                </label>
                <select
                  className="w-full border border-blue-300 p-2 rounded text-sm bg-white"
                  value={triggerStrategy || ''}
                  onChange={e => setTriggerStrategy(e.target.value || null)}
                >
                  <option value="">-- Select Strategy --</option>
                  <option value="time_based">Time-Based (Month Count)</option>
                  <option value="value_based">Value-Based (Threshold Operator)</option>
                </select>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action Button Layout */}
      <div className="mt-4">
        {phases.length < 4 ? (
          <button
            type="button"
            onClick={handleAddPhase}
            className="w-full py-2 px-4 border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 rounded text-sm font-medium transition-colors"
          >
            + Do you want to add another phase?
          </button>
        ) : (
          <div className="w-full py-2 px-4 bg-gray-100 border border-gray-300 text-gray-500 rounded text-sm text-center font-medium">
            You have reached the maximum of four phases
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
