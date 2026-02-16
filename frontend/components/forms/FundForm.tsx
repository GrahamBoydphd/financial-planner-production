import { useState, useEffect } from 'react';
import { api, Fund } from '@/lib/api';
import Button from '@/components/ui/Button';
import { EconophysicsInputs } from '@/components/forms/shared/EconophysicsInputs';
import { DescriptionInput } from '@/components/forms/shared/DescriptionInput';

interface FundFormProps {
  onSuccess?: () => void;
  initialData?: Fund | null;
  onCancel?: () => void;
}

export default function FundForm({ onSuccess, initialData, onCancel }: FundFormProps) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [description, setDescription] = useState('');
  
  // Econophysics / Success Tax
  const [softLimitActive, setSoftLimitActive] = useState(true);
  const [softLimitThreshold, setSoftLimitThreshold] = useState('100,000,000'); // Default 100M formatted
  const [softLimitFraction, setSoftLimitFraction] = useState('70'); // Default 70%

  useEffect(() => {
    if (initialData) {
      setName(initialData.fund_name);
      setCurrency(initialData.currency_code || 'EUR');
      setDescription(initialData.description || '');
      
      // Explicitly update Econophysics state
      setSoftLimitActive(initialData.default_soft_limit_active ?? true);
      
      setSoftLimitThreshold(
        initialData.default_soft_limit_threshold 
          ? Number(initialData.default_soft_limit_threshold).toLocaleString() 
          : '100,000,000'
      );
      
      setSoftLimitFraction(
        initialData.default_soft_limit_fraction 
          ? (Number(initialData.default_soft_limit_fraction) * 100).toString() 
          : '70'
      );
    } else {
      setName('');
      setCurrency('EUR');
      setDescription('');
      setSoftLimitActive(true);
      setSoftLimitThreshold('100,000,000');
      setSoftLimitFraction('70');
    }
  }, [initialData]);

  const handleSoftLimitActiveChange = (newValue: boolean) => {
    if (!newValue) {
      if (window.confirm("Disabling this leads to physically unrealistic behaviours")) {
        setSoftLimitActive(false);
      }
    } else {
      setSoftLimitActive(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Prepare data for API
      const cleanThreshold = softLimitThreshold.replace(/,/g, '');
      const cleanFraction = (Number(softLimitFraction) / 100).toString();

      if (initialData) {
        await api.updateFund(
          initialData.id, 
          name, 
          currency,
          description,
          softLimitActive,
          cleanThreshold,
          cleanFraction
        );
      } else {
        await api.createFund(
          name, 
          currency,
          description,
          softLimitActive,
          cleanThreshold,
          cleanFraction
        );
      }
      
      if (!initialData) {
        setName('');
        setCurrency('EUR');
        setDescription('');
        setSoftLimitActive(true);
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

        <DescriptionInput 
          value={description}
          onChange={setDescription}
          placeholder="Fund investment thesis and description..."
        />
      </div>

      {/* Econophysics & Friction Section */}
      <div className="border-t pt-4 mt-4">
        <EconophysicsInputs
          active={softLimitActive}
          threshold={softLimitThreshold}
          fraction={softLimitFraction}
          currencyCode={currency}
          onChangeActive={handleSoftLimitActiveChange}
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
