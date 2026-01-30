import React, { useState, useEffect } from 'react';
import { api, SwanEvent, Fund, Company } from '@/lib/api';
import { Loader2, Save, X } from 'lucide-react';

interface EventFormProps {
  fundId: string;
  funds: Fund[];
  companies: Company[];
  initialData?: SwanEvent | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function EventForm({ fundId, funds, companies, initialData, onSuccess, onCancel }: EventFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Raw probability string for input handling (0-100)
  const [rawProbability, setRawProbability] = useState<string>('5.0');
  const [isCounterCyclic, setIsCounterCyclic] = useState(false);

  const [event, setEvent] = useState<Partial<SwanEvent>>({
    scope: 'local',
    target_ids: [],
    event_type: 'revenue_shock',
    event_name: '',
    occurrence_probability: '5.0',
    magnitude: 'medium', // Default Medium
    duration: 'medium',     // Default Medium
    direction: 'detrimental_only',
  });

  useEffect(() => {
    if (initialData) {
      setEvent({
        event_name: initialData.event_name,
        event_type: initialData.event_type,
        scope: initialData.scope || 'local',
        target_ids: initialData.target_ids,
        occurrence_probability: initialData.occurrence_probability,
        magnitude: initialData.magnitude,
        direction: initialData.direction,
        duration: initialData.duration,
      });
      setIsCounterCyclic(initialData.is_counter_cyclic || false);
      
      // Logic: Handle legacy decimals vs new whole numbers
      let val = parseFloat(initialData.occurrence_probability || '0');
      if (val <= 1 && val > 0) {
          val = val * 100;
      }
      setRawProbability(val.toString());
    } else {
      // Reset to defaults if creating new
      setEvent({
        scope: 'local',
        target_ids: [],
        event_type: 'revenue_shock',
        event_name: '',
        occurrence_probability: '5.0',
        magnitude: 'medium',
        duration: 'medium',
        direction: 'detrimental_only',
      });
      setRawProbability('5.0');
      setIsCounterCyclic(false);
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Parse probability
      const probValue = parseFloat(rawProbability);
      if (isNaN(probValue) || probValue < 0 || probValue > 100) {
        throw new Error("Probability must be between 0 and 100");
      }
      // Send raw value directly (e.g., "5.0" for 5%), do not divide by 100.
      const finalProbability = probValue.toString();

      // Validation
      if (!event.event_name) throw new Error("Event name is required");
      if (event.scope === 'local' && (!event.target_ids || event.target_ids.length === 0)) {
        throw new Error("Please select a target company for local event");
      }
      if (event.scope === 'global' && (!event.target_ids || event.target_ids.length === 0)) {
        throw new Error("Please select at least one fund for global event");
      }

      // Construct payload with ONLY the required fields
      const payload: Omit<SwanEvent, 'id'> = {
        event_name: event.event_name || '',
        event_type: event.event_type || 'revenue_shock',
        scope: event.scope || 'local',
        target_ids: event.target_ids || [],
        occurrence_probability: finalProbability,
        magnitude: event.magnitude || 'medium',
        direction: event.direction || 'detrimental_only',
        duration: event.duration || 'medium',
        is_counter_cyclic: isCounterCyclic,
      };

      if (initialData && initialData.id) {
        await api.updateEvent(initialData.id, payload);
      } else {
        await api.createEvent(payload);
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save event");
    } finally {
      setLoading(false);
    }
  };

  const handleTargetToggle = (id: string) => {
    const currentTargets = event.target_ids || [];
    if (currentTargets.includes(id)) {
      setEvent({ ...event, target_ids: currentTargets.filter(t => t !== id) });
    } else {
      setEvent({ ...event, target_ids: [...currentTargets, id] });
    }
  };

  const handleProbabilityChange = (val: string) => {
    setRawProbability(val);
  };

  const getCounterCyclicExplainer = () => {
    switch (event.direction) {
      case 'both_neutral': return 'Even split: 50% Detrimental, 50% Beneficial (Full Impact on both).';
      case 'both_biased_detrimental': return 'Biased split: ~75% Detrimental (Full Impact), ~25% Beneficial (0.25x Impact).';
      case 'both_biased_beneficial': return 'Biased split: ~75% Beneficial (Full Impact), ~25% Detrimental (0.25x Impact).';
      default: return '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex justify-between items-center border-b pb-2 mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          {initialData ? 'Edit Swan Event' : 'New Swan Event'}
        </h3>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded text-sm border border-red-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Info */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700">Event Name</label>
          <input
            type="text"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
            value={event.event_name}
            onChange={(e) => setEvent({ ...event, event_name: e.target.value })}
            placeholder="e.g. Market Crash 2025"
          />
        </div>

        {/* Scope Selector - Radio Buttons */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Scope</label>
          <div className="flex items-center space-x-6">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="scope"
                value="local"
                checked={event.scope === 'local'}
                onChange={() => setEvent({ ...event, scope: 'local', target_ids: [] })}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Local (Specific Company)</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="scope"
                value="global"
                checked={event.scope === 'global'}
                onChange={() => setEvent({ ...event, scope: 'global', target_ids: [] })}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Global (Multi-Fund)</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Event Type</label>
          <select
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
            value={event.event_type}
            onChange={(e) => setEvent({ ...event, event_type: e.target.value })}
          >
            <option value="revenue_shock">Revenue Shock</option>
            <option value="expense_shock">Expense Shock</option>
            <option value="valuation_shock">Valuation Shock</option>
          </select>
        </div>

        {/* Target Selection */}
        <div className="col-span-2 bg-gray-50 p-3 rounded border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {event.scope === 'global' ? 'Target Funds (Global Scope)' : 'Target Company (Local Scope)'}
          </label>
          
          {event.scope === 'global' ? (
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {funds.map(f => (
                <label key={f.id} className="flex items-center space-x-2 text-sm p-1 hover:bg-gray-100 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(event.target_ids || []).includes(f.id)}
                    onChange={() => handleTargetToggle(f.id)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{f.fund_name}</span>
                </label>
              ))}
              {funds.length === 0 && <p className="text-sm text-gray-500 italic">No funds available.</p>}
            </div>
          ) : (
            <select
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              value={(event.target_ids && event.target_ids[0]) || ''}
              onChange={(e) => setEvent({ ...event, target_ids: [e.target.value] })}
            >
              <option value="">-- Select Company --</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Parameters */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Annual Probability (%)</label>
          <div className="relative mt-1 rounded-md shadow-sm">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 pr-8"
              value={rawProbability}
              onChange={(e) => handleProbabilityChange(e.target.value)}
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-gray-500 sm:text-sm">%</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Magnitude</label>
          <select
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
            value={event.magnitude}
            onChange={(e) => setEvent({ ...event, magnitude: e.target.value })}
          >
            <option value="small">Small (10%)</option>
            <option value="medium">Medium (30%)</option>
            <option value="large">Large (50%)</option>
            <option value="catastrophic">Catastrophic (80%)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Duration</label>
          <select
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
            value={event.duration}
            onChange={(e) => setEvent({ ...event, duration: e.target.value })}
          >
            <option value="short">Short (1-4 months)</option>
            <option value="medium">Medium (4-8 months)</option>
            <option value="long">Long (8-24 months)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Direction</label>
          <select
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
            value={event.direction}
            onChange={(e) => setEvent({ ...event, direction: e.target.value })}
          >
            <option value="detrimental_only">Detrimental Only</option>
            <option value="beneficial_only">Beneficial Only</option>
            <option value="both_neutral">Both (Neutral)</option>
            <option value="both_biased_detrimental">Both (Biased Detrimental)</option>
            <option value="both_biased_beneficial">Both (Biased Beneficial)</option>
          </select>
        </div>

        {/* Counter-Cyclic Option (Only for Global + Both Directions) */}
        {event.scope === 'global' && event.direction?.includes('both') && (
          <div className="col-span-2 bg-indigo-50 p-4 rounded-md border border-indigo-100 mt-2">
            <label className="block text-sm font-medium text-indigo-900 mb-2">Global Response Distribution</label>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="counterCyclic"
                  checked={!isCounterCyclic}
                  onChange={() => setIsCounterCyclic(false)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">
                  <span className="font-medium">Uniform Response (Default):</span> All companies in the fund have the same response.
                </span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="counterCyclic"
                  checked={isCounterCyclic}
                  onChange={() => setIsCounterCyclic(true)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">
                  <span className="font-medium">Random Counter-Cyclic:</span> Some companies react oppositely.
                </span>
              </label>
            </div>
            
            {isCounterCyclic && (
              <div className="mt-2 ml-6 text-xs text-indigo-700 italic">
                {getCounterCyclicExplainer()}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
        >
          <X size={16} className="mr-2" /> Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
          {initialData ? 'Update Event' : 'Create Event'}
        </button>
      </div>
    </form>
  );
}
