import { useState } from 'react';
import { api } from '@/lib/api';
import Button from '@/components/ui/Button';

export default function FundForm({ onSuccess }: { onSuccess?: () => void }) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Removed placeholder user_id, relying on Auth header
      await api.createFund(name, currency);
      setName('');
      setCurrency('USD');
      onSuccess?.();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to create fund');
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
          className="w-full p-2 border rounded"
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </select>
      </div>

      <Button type="submit">Create Fund</Button>
    </form>
  );
}
