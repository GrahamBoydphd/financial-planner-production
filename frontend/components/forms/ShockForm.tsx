import React, { useState, useEffect } from 'react';
import { api, Shock, Company } from '@/lib/api';
import { Loader2, Save, X } from 'lucide-react';

interface ShockFormProps {
  fundId: string;
  companies: Company[];
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Shock | null;
}

export default function ShockForm({ fundId, companies, onSuccess, onCancel, initialData }: ShockFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Shock>>({
    fund_id: fundId,
    scope: 'global',
    shock_type: 'revenue_hit',
    name: '',
    occurrence_probability: '10',
    magnitude: 'medium',
    duration: 'short',
    direction: 'detrimental_only',
    volatility_type: 'none',
    vol_min: '0',
    vol_max: '0',
    vol_mean: '0',
    vol_scale: '0',
    vol_freedom: '0',
    vol_alpha: '0',
    vol_beta: '0',
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData(prev => ({ ...prev, fund_id: fundId }));
    }
  }, [initialData, fundId]);

  const handleChange = (field: keyof Shock, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (initialData?.id) {
        await api.updateShock(initialData.id, formData);
      } else {
        await api.createShock(formData as Omit<Shock, 'id'>);
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save shock');
    } finally {
      setLoading(false);
    }
  };

  const STANDARD_TYPES = ['revenue_hit', 'expense_spike', 'valuation_drop'];
  const currentShockType = formData.shock_type || 'revenue_hit';
  const selectValue = STANDARD_TYPES.includes(currentShockType) ? currentShockType : 'custom';

  const handleTypeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      if (STANDARD_TYPES.includes(currentShockType)) {
        handleChange('shock_type', '');
      }
    } else {
      handleChange('shock_type', val);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Shock Name</label>
          <input
            type="text"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
            value={formData.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g. Market Crash 2025"
          />
        </div>

        {/* Scope */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Scope</label>
          <div className="mt-2 flex gap-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio text-indigo-600"
                name="scope"
                value="global"
                checked={formData.scope === 'global'}
                onChange={() => handleChange('scope', 'global')}
              />
              <span className="ml-2">Global (Fund)</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio text-indigo-600"
                name="scope"
                value="local"
                checked={formData.scope === 'local'}
                onChange={() => handleChange('scope', 'local')}
              />
              <span className="ml-2">Local (Company)</span>
            </label>
          </div>
        </div>

        {/* Target (Only if Local) */}
        {formData.scope === 'local' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Target Company</label>
            <select
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              value={formData.target_id || ''}
              onChange={(e) => handleChange('target_id', e.target.value)}
              required={formData.scope === 'local'}
            >
              <option value="">Select a company...</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Shock Type</label>
          <select
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
            value={selectValue}
            onChange={handleTypeSelect}
          >
            <option value="revenue_hit">Revenue Hit</option>
            <option value="expense_spike">Expense Spike</option>
            <option value="valuation_drop">Valuation Drop</option>
            <option value="custom">Custom</option>
          </select>
          {selectValue === 'custom' && (
            <input
              type="text"
              className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              placeholder="Enter custom shock type..."
              value={formData.shock_type || ''}
              onChange={(e) => handleChange('shock_type', e.target.value)}
              required
            />
          )}
        </div>

        {/* Probability */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Annual Probability (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
            value={formData.occurrence_probability || ''}
            onChange={(e) => handleChange('occurrence_probability', e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">Likelihood of occurring in any given year (e.g. 10% = 1 in 10 years)</p>
        </div>

        {/* Magnitude, Duration & Direction */}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded-lg bg-gray-50">
          <div>
            <label className="block text-sm font-medium text-gray-700">Magnitude</label>
            <select
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              value={formData.magnitude || 'medium'}
              onChange={(e) => handleChange('magnitude', e.target.value)}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Duration</label>
            <select
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              value={formData.duration || 'short'}
              onChange={(e) => handleChange('duration', e.target.value)}
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
              value={formData.direction || 'detrimental_only'}
              onChange={(e) => handleChange('direction', e.target.value)}
            >
              <option value="detrimental_only">Detrimental Only</option>
              <option value="beneficial_only">Beneficial Only</option>
              <option value="both_neutral">Both (Neutral)</option>
              <option value="both_detrimental">Both (Biased Detrimental)</option>
              <option value="both_beneficial">Both (Biased Beneficial)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Probability / Volatility Section */}
      <div className="border-t pt-4 mt-4 opacity-50 pointer-events-none relative">
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">Available in Advanced Edition</span>
        </div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Probability Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Distribution Type</label>
            <select
              disabled
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-gray-100"
              value={formData.volatility_type || 'none'}
              onChange={(e) => handleChange('volatility_type', e.target.value)}
            >
              <option value="none">None (Deterministic)</option>
              <option value="flat">Flat / Uniform</option>
              <option value="student_t">Student's T</option>
              <option value="nrig">NRIG (Normal-Reciprocal Inverse Gaussian)</option>
            </select>
          </div>

          {/* Dynamic Fields based on Volatility Type */}
          {formData.volatility_type === 'flat' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Min</label>
                <input disabled type="number" step="0.01" className="mt-1 block w-full border p-2 rounded bg-gray-100" value={formData.vol_min || ''} onChange={e => handleChange('vol_min', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Max</label>
                <input disabled type="number" step="0.01" className="mt-1 block w-full border p-2 rounded bg-gray-100" value={formData.vol_max || ''} onChange={e => handleChange('vol_max', e.target.value)} />
              </div>
            </>
          )}

          {formData.volatility_type === 'student_t' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Mean (Location)</label>
                <input disabled type="number" step="0.01" className="mt-1 block w-full border p-2 rounded bg-gray-100" value={formData.vol_mean || ''} onChange={e => handleChange('vol_mean', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Scale</label>
                <input disabled type="number" step="0.01" className="mt-1 block w-full border p-2 rounded bg-gray-100" value={formData.vol_scale || ''} onChange={e => handleChange('vol_scale', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Degrees of Freedom</label>
                <input disabled type="number" step="0.01" className="mt-1 block w-full border p-2 rounded bg-gray-100" value={formData.vol_freedom || ''} onChange={e => handleChange('vol_freedom', e.target.value)} />
              </div>
            </>
          )}

          {formData.volatility_type === 'nrig' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Alpha</label>
                <input disabled type="number" step="0.01" className="mt-1 block w-full border p-2 rounded bg-gray-100" value={formData.vol_alpha || ''} onChange={e => handleChange('vol_alpha', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Beta</label>
                <input disabled type="number" step="0.01" className="mt-1 block w-full border p-2 rounded bg-gray-100" value={formData.vol_beta || ''} onChange={e => handleChange('vol_beta', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Mean</label>
                <input disabled type="number" step="0.01" className="mt-1 block w-full border p-2 rounded bg-gray-100" value={formData.vol_mean || ''} onChange={e => handleChange('vol_mean', e.target.value)} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
          Save Shock
        </button>
      </div>
    </form>
  );
}
