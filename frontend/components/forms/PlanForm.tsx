import { useState, useEffect } from 'react';
import { api, Company, FinancialPlan } from '@/lib/api';
import Button from '@/components/ui/Button';

interface PlanFormProps {
  companies: Company[];
  onSuccess: () => void;
  initialData?: FinancialPlan;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR'];

export default function PlanForm({ companies, onSuccess, initialData }: PlanFormProps) {
  const [name, setName] = useState(initialData?.plan_name || '');
  const [startMonth, setStartMonth] = useState(initialData?.start_month || '');
  const [selectedCompany, setSelectedCompany] = useState(initialData?.company_id || '');
  const [currency, setCurrency] = useState(initialData?.currency_code || 'USD');
  const [description, setDescription] = useState(initialData?.description || '');
  
  // Pooling fraction state (0-100 for UI, mapped to 0.0-1.0 for API)
  // Only relevant for updates, as createPlan doesn't accept it.
  const [poolingFraction, setPoolingFraction] = useState<number>(
    initialData?.pooling_fraction ? parseFloat(initialData.pooling_fraction) * 100 : 0
  );

  useEffect(() => {
    if (initialData) {
      setName(initialData.plan_name);
      setStartMonth(initialData.start_month);
      setSelectedCompany(initialData.company_id);
      setCurrency(initialData.currency_code || 'USD');
      setDescription(initialData.description || '');
      setPoolingFraction(initialData.pooling_fraction ? parseFloat(initialData.pooling_fraction) * 100 : 0);
    }
  }, [initialData]);

  // Sync currency with selected company in Create mode
  useEffect(() => {
    if (!initialData && selectedCompany) {
      const company = companies.find(c => c.id === selectedCompany);
      if (company && company.currency_code) {
        setCurrency(company.currency_code);
      }
    }
  }, [selectedCompany, companies, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return alert('Please select a company');
    
    // Word count validation
    const wordCount = description.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 200) {
      alert(`Description cannot exceed 200 words. Current: ${wordCount}`);
      return;
    }

    try {
      if (initialData) {
        // Update Mode: Can send pooling_fraction
        await api.updatePlan(initialData.id, {
          plan_name: name,
          start_month: startMonth,
          pooling_fraction: (poolingFraction / 100).toString(),
          description,
        });
      } else {
        // Create Mode: Strict payload { company_id, name, start_month, currency, description }
        await api.createPlan(selectedCompany, name, startMonth, currency, description);
      }
      
      if (!initialData) {
        setName('');
        setStartMonth('');
        setPoolingFraction(0);
        setSelectedCompany('');
        setCurrency('USD');
        setDescription('');
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
            <option key={c.id} value={c.id}>{c.company_name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Currency</label>
        <select
          className="w-full p-2 border rounded disabled:bg-gray-100"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          required
          disabled={!!initialData}
        >
          {CURRENCIES.map(c => (
            <option key={c} value={c}>{c}</option>
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
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-2 border rounded h-24"
          placeholder="Brief description of the plan..."
        />
        <div className="text-xs text-gray-500 text-right mt-1">
          {description.trim().split(/\s+/).filter(Boolean).length}/200 words
        </div>
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

      {/* Non-Ergodicity Correction Slider - Only show in Update mode or if we decide to chain calls later. 
          For now, hiding in Create mode to strictly follow API payload rules. */}
      {initialData && (
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
      )}

      <Button type="submit" disabled={!selectedCompany}>
        {initialData ? 'Update Plan' : 'Create Plan'}
      </Button>
    </form>
  );
}
