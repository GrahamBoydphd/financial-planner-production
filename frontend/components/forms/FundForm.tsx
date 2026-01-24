import { useState, useEffect } from 'react';
import { api, Fund } from '@/lib/api';
import Button from '@/components/ui/Button';

interface FundFormProps {
  onSuccess?: () => void;
  initialData?: Fund | null;
  onCancel?: () => void;
}

export default function FundForm({ onSuccess, initialData, onCancel }: FundFormProps) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('EUR');

  useEffect(() => {
    if (initialData) {
      setName(initialData.fund_name);
      setCurrency(initialData.currency_code || 'EUR');
    } else {
      setName('');
      setCurrency('EUR');
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (initialData) {
        await api.updateFund(initialData.id, name, currency);
      } else {
        await api.createFund(name, currency);
      }
      
      if (!initialData) {
        // Only clear if creating. If editing, we might want to keep state until parent clears it, 
        // but usually onSuccess triggers a refresh which might unmount or reset.
        // We'll clear for consistency.
        setName('');
        setCurrency('EUR');
      }
      onSuccess?.();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to save fund');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <div className="flex gap-2">
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
