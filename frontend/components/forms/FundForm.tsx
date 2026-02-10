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
