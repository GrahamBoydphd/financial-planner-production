import { useState, useEffect } from 'react';
import { api, Company, FinancialPlan } from '@/lib/api';
import Button from '@/components/ui/Button';

interface PlanFormProps {
  onSuccess: () => void;
  initialData?: FinancialPlan;
}

export default function PlanForm({ onSuccess, initialData }: PlanFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [startMonth, setStartMonth] = useState(initialData?.start_month || '');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState(initialData?.company_id || '');
  
  // Pooling fraction state (0-100 for UI, mapped to 0.0-1.0 for API)
  const [poolingFraction, setPoolingFraction] = useState<number>(
    initialData?.pooling_fraction ? initialData.pooling_fraction * 100 : 0
  );

  useEffect(() => {
    // Fetch companies for the dropdown
    api.getCompanies().then(setCompanies).catch(console.error);
  }, []);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setStartMonth(initialData.start_month);
      setSelectedCompany(initialData.company_id);
      setPoolingFraction((initialData.pooling_fraction || 0) * 100);
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return alert('Please select a company');
    
    try {
      if (initialData) {
        await api.updatePlan(initialData.id, {
          name,
          start_month: startMonth,
          pooling_fraction: poolingFraction / 100,
        });
      } else {
        // Create currently uses default pooling (0.0)
        await api.createPlan(selectedCompany, name, startMonth);
      }
      
      if (!initialData) {
        setName('');
        setStartMonth('');
        setPoolingFraction(0);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Failed to save plan');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Company</label>
        <select 
          className="w-full p-2 border rounded disabled:bg-gray-100"
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
          required
          disabled={!!initialData}
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

      {/* Non-Ergodicity Correction Slider */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label 
            className="block text-sm font-medium cursor-help underline decoration-dotted"
            title="Strength of the correction factor for non-ergodicity. Pooling this fraction of profits reduces variance across the ensemble."
          >
            Non-Ergodicity Correction
          </label>
          <span className="text-sm font-mono text-gray-700">{poolingFraction.toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={poolingFraction}
          onChange={(e) => setPoolingFraction(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <p className="text-xs text-gray-500 mt-1">
          Pooling profits reduces variance (risk) at the cost of potential upside outliers.
        </p>
      </div>

      <Button type="submit" disabled={!selectedCompany}>
        {initialData ? 'Update Plan' : 'Create Plan'}
      </Button>
    </form>
  );
}
