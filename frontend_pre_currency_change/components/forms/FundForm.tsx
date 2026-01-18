import { useState, useEffect } from 'react';
import { api, Fund } from '@/lib/api';
import Button from '@/components/ui/Button';

interface Props {
  onSuccess?: () => void;
  initialData?: Fund;
  onCancel?: () => void;
}

export default function FundForm({ onSuccess, initialData, onCancel }: Props) {
  const [name, setName] = useState(initialData?.name || '');
  const [currencyCode, setCurrencyCode] = useState(initialData?.currency_code || 'USD');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setCurrencyCode(initialData.currency_code || 'USD');
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (initialData) {
        await api.updateFund(initialData.id, name, currencyCode);
      } else {
        await api.createFund(name, currencyCode);
      }
      
      if (!initialData) {
        setName('');
        setCurrencyCode('USD');
      }
      onSuccess?.();
    } catch (err) {
      console.error(err);
      alert(`Failed to ${initialData ? 'update' : 'create'} fund`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded shadow">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">{initialData ? 'Edit Fund' : 'New Fund'}</h3>
        {initialData && onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-red-500 hover:underline">Cancel</button>
        )}
      </div>

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
          value={currencyCode}
          onChange={(e) => setCurrencyCode(e.target.value)}
          className="w-full p-2 border rounded bg-white"
        >
          <option value="USD">USD ($)</option>
          <option value="GBP">GBP (£)</option>
          <option value="EUR">EUR (€)</option>
          <option value="JPY">JPY (¥)</option>
        </select>
      </div>
      <Button type="submit">{initialData ? 'Update Fund' : 'Create Fund'}</Button>
    </form>
  );
}
