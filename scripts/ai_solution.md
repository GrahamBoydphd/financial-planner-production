🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
<file path='frontend/components/forms/shared/EconophysicsInputs.tsx'>
import React from 'react';

export interface EconophysicsInputsProps {
  active: boolean;
  threshold: string;
  fraction: string;
  currencyCode?: string;
  onChangeActive: (val: boolean) => void;
  onChangeThreshold: (val: string) => void;
  onChangeFraction: (val: string) => void;
}

export const EconophysicsInputs: React.FC<EconophysicsInputsProps> = ({
  active,
  threshold,
  fraction,
  currencyCode = 'EUR',
  onChangeActive,
  onChangeThreshold,
  onChangeFraction,
}) => {
  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove commas to get raw number string
    const rawValue = e.target.value.replace(/,/g, '');
    if (rawValue === '') {
      onChangeThreshold('');
      return;
    }
    const num = Number(rawValue);
    if (!isNaN(num)) {
      onChangeThreshold(num.toLocaleString());
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Econophysics & Friction</h3>
        <div className="text-sm text-gray-500 mb-4 italic space-y-2">
          <p>
            This simulation does not yet have any of the limiting aspects that become relevant when companies grow very large. 
            To stay aligned with <strong>Econophysics</strong> we need a way to represent the friction of the real world, which increases with scale:
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-1">
            <li><strong>Diminishing Returns:</strong> Doubling a 100B company is harder than doubling a 1M company.</li>
            <li><strong>Resource Constraints:</strong> The material supply, the market for your product, isn't infinite (GDP cap).</li>
            <li><strong>Regulatory/Social Friction:</strong> Antitrust, strikes, higher taxes, organizational entropy.</li>
          </ol>
        </div>
      </div>

      <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="econophysicsActive"
            checked={active}
            onChange={(e) => onChangeActive(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="econophysicsActive" className="text-sm font-medium text-gray-700">
            Enable Friction / Success Tax
          </label>
        </div>

        {active && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Threshold ({currencyCode})
              </label>
              <input
                type="text"
                value={threshold}
                onChange={handleThresholdChange}
                className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="100,000,000"
              />
              <p className="text-xs text-gray-500 mt-1">
                Value above which friction applies.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Friction Loss on excess (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={fraction}
                  onChange={(e) => onChangeFraction(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500 pr-8"
                  placeholder="5"
                />
                <span className="absolute right-3 top-2 text-gray-500">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                % of excess value removed annually.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
</file>

<file path='frontend/components/forms/SuccessTaxForm.tsx'>
import { useState, useEffect } from 'react';
import { api, FinancialPlan } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { EconophysicsInputs } from '@/components/forms/shared/EconophysicsInputs';

interface SuccessTaxFormProps {
  plan: FinancialPlan;
  onSuccess: () => void;
}

export default function SuccessTaxForm({ plan, onSuccess }: SuccessTaxFormProps) {
  const [active, setActive] = useState(false);
  const [threshold, setThreshold] = useState('100,000,000');
  const [fraction, setFraction] = useState('5'); // Display as 0-100
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (plan) {
      setActive(plan.soft_limit_active || false);
      
      // Format threshold with commas
      const rawThreshold = plan.soft_limit_threshold || '100000000';
      setThreshold(Number(rawThreshold).toLocaleString());
      
      // Convert fraction 0.0-1.0 to 0-100 for display
      const rawFraction = parseFloat(plan.soft_limit_fraction || '0');
      setFraction((rawFraction * 100).toString());
    }
  }, [plan]);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Remove commas for API
      const cleanThreshold = threshold.replace(/,/g, '');
      // Convert 0-100 back to 0.0-1.0 for API
      const cleanFraction = (parseFloat(fraction) / 100).toString();

      await api.updatePlan(plan.id, {
        soft_limit_active: active,
        soft_limit_threshold: cleanThreshold,
        soft_limit_fraction: cleanFraction
      });
      onSuccess();
      alert('Success Tax settings saved.');
    } catch (err) {
      console.error(err);
      alert('Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <EconophysicsInputs
        active={active}
        threshold={threshold}
        fraction={fraction}
        currencyCode={plan.currency_code}
        onChangeActive={setActive}
        onChangeThreshold={setThreshold}
        onChangeFraction={setFraction}
      />

      <div className="mt-4 flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </Card>
  );
}
</file>

<file path='frontend/components/forms/FundForm.tsx'>
import { useState, useEffect } from 'react';
import { api, Fund } from '@/lib/api';
import Button from '@/components/ui/Button';
import { EconophysicsInputs } from '@/components/forms/shared/EconophysicsInputs';

interface FundFormProps {
  onSuccess?: () => void;
  initialData?: Fund | null;
  onCancel?: () => void;
}

export default function FundForm({ onSuccess, initialData, onCancel }: FundFormProps) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  
  // Econophysics / Success Tax
  const [softLimitActive, setSoftLimitActive] = useState(false);
  const [softLimitThreshold, setSoftLimitThreshold] = useState('100,000,000'); // Default 100M formatted
  const [softLimitFraction, setSoftLimitFraction] = useState('70'); // Default 70%

  useEffect(() => {
    if (initialData) {
      setName(initialData.fund_name);
      setCurrency(initialData.currency_code || 'EUR');
      setSoftLimitActive(initialData.soft_limit_active || false);
      
      // Format threshold
      const rawThreshold = initialData.soft_limit_threshold || '100000000';
      setSoftLimitThreshold(Number(rawThreshold).toLocaleString());
      
      // Format fraction (0.0-1.0 -> 0-100)
      const rawFraction = parseFloat(initialData.soft_limit_fraction || '0.7');
      setSoftLimitFraction((rawFraction * 100).toString());
    } else {
      setName('');
      setCurrency('EUR');
      setSoftLimitActive(false);
      setSoftLimitThreshold('100,000,000');
      setSoftLimitFraction('70');
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Prepare data for API
      const cleanThreshold = softLimitThreshold.replace(/,/g, '');
      const cleanFraction = (parseFloat(softLimitFraction) / 100).toString();

      if (initialData) {
        await api.updateFund(
          initialData.id, 
          name, 
          currency,
          softLimitActive,
          cleanThreshold,
          cleanFraction
        );
      } else {
        await api.createFund(
          name, 
          currency,
          softLimitActive,
          cleanThreshold,
          cleanFraction
        );
      }
      
      if (!initialData) {
        setName('');
        setCurrency('EUR');
        setSoftLimitActive(false);
        setSoftLimitThreshold('100,000,000');
        setSoftLimitFraction('70');
      }
      onSuccess?.();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to save fund');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Fund Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="e.g. My VC Fund I"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled
            className="w-full p-2 border rounded bg-gray-100 text-gray-500 cursor-not-allowed"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </div>

      {/* Econophysics & Friction Section */}
      <div className="border-t pt-4 mt-4">
        <EconophysicsInputs
          active={softLimitActive}
          threshold={softLimitThreshold}
          fraction={softLimitFraction}
          currencyCode={currency}
          onChangeActive={setSoftLimitActive}
          onChangeThreshold={setSoftLimitThreshold}
          onChangeFraction={setSoftLimitFraction}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit">{initialData ? 'Update Fund' : 'Create Fund'}</Button>
        {initialData && (
          <button 
            type="button" 
            onClick={onCancel}
            className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
</file>

