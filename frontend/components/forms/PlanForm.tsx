// frontend/components/forms/PlanForm.tsx
import { useState, useEffect } from 'react';
import { api, Company } from '@/lib/api';
import Button from '@/components/ui/Button';

export default function PlanForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState('');

  useEffect(() => {
    // Fetch companies for the dropdown
    api.getCompanies().then(setCompanies).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return alert('Please select a company');
    
    try {
      await api.createPlan(selectedCompany, name, startMonth);
      setName('');
      setStartMonth('');
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Failed to create plan');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Company</label>
        <select 
          className="w-full p-2 border rounded"
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
          required
        >
          <option value="">Select a Company</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Plan Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="e.g. 2025 Growth Plan"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Start Month</label>
        <input
          type="date"
          value={startMonth}
          onChange={(e) => setStartMonth(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <Button type="submit" disabled={!selectedCompany}>Create Plan</Button>
    </form>
  );
}
