🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
<file path='frontend/components/forms/CompanyForm.tsx'>
import { useState } from 'react';
import { api, Fund } from '@/lib/api';
import Button from '@/components/ui/Button';

// --- IMT Options ---
const INDUSTRY_OPTIONS = [
  "Clean Energy / Decarbonization", "Regenerative Ag / Food Systems", "Circular Economy / Waste",
  "WASH (Water/Sanitation)", "Disaster Relief / Resilience", "Affordable Housing", 
  "Education / EdTech", "Health / Bio / Pharma", "Fintech / Financial Inclusion",
  "Logistics / Supply Chain", "Manufacturing / Industrial", "Other"
];

const MODEL_OPTIONS = [
  "SaaS / Subscription", "Marketplace / Platform", "Carbon Markets / Ecosystem Services",
  "Circular / Product-as-a-Service", "Cooperative / Community Ownership", 
  "Cross-Subsidization", "Social Impact Bond", "Hardware Sales", "Service / Agency", "Other"
];

const TECH_OPTIONS = [
  "CleanTech", "CCUS (Carbon Capture)", "AgriTech / Bio-Systems", 
  "Off-Grid / Decentralized Infra", "Appropriate Tech / Frugal Innovation", 
  "AI / ML", "Web / Mobile", "Blockchain / ReFi", "Material Science", "Other"
];

export default function CompanyForm({ onSuccess, funds = [] }: { onSuccess?: () => void, funds?: Fund[] }) {
  const [name, setName] = useState('');
  const [selectedFund, setSelectedFund] = useState('');
  const [currency, setCurrency] = useState('USD');

  // IMT State
  const [industry, setIndustry] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
  
  const [model, setModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  
  const [tech, setTech] = useState('');
  const [customTech, setCustomTech] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFund) return alert('Select a fund');
    
    // Resolve "Other" fields
    const finalIndustry = industry === 'Other' ? customIndustry : industry;
    const finalModel = model === 'Other' ? customModel : model;
    const finalTech = tech === 'Other' ? customTech : tech;

    try {
      // No user_id passed here, relying on Auth header
      // FIXED: Argument order updated to match api.ts: (name, fund_id, currency, industry, model, tech)
      await api.createCompany(name, selectedFund, currency, finalIndustry, finalModel, finalTech);
      
      setName('');
      setCurrency('USD');
      setIndustry(''); setCustomIndustry('');
      setModel(''); setCustomModel('');
      setTech(''); setCustomTech('');
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      alert('Failed to create company');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold text-gray-800">New Company</h3>
      
      {/* Fund Selection */}
      <div>
        <label className="block text-sm font-medium mb-1">Parent Fund</label>
        <select
          value={selectedFund}
          onChange={(e) => setSelectedFund(e.target.value)}
          className="w-full p-2 border rounded"
          required
        >
          <option value="">Select a Fund</option>
          {funds.map(f => (
            <option key={f.id} value={f.id}>{f.fund_name}</option>
          ))}
        </select>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium mb-1">Company Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="e.g. GreenFuture Ltd"
          required
        />
      </div>

      {/* Currency */}
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

      {/* Industry */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Industry (Sector)</label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Select Industry</option>
            {INDUSTRY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {industry === 'Other' && (
            <input
              type="text"
              placeholder="Specify Industry..."
              value={customIndustry}
              onChange={(e) => setCustomIndustry(e.target.value)}
              className="mt-2 w-full p-2 border rounded text-sm"
            />
          )}
        </div>

        {/* Business Model */}
        <div>
          <label className="block text-sm font-medium mb-1">Business Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Select Model</option>
            {MODEL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {model === 'Other' && (
            <input
              type="text"
              placeholder="Specify Model..."
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              className="mt-2 w-full p-2 border rounded text-sm"
            />
          )}
        </div>

        {/* Technology */}
        <div>
          <label className="block text-sm font-medium mb-1">Technology</label>
          <select
            value={tech}
            onChange={(e) => setTech(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Select Tech</option>
            {TECH_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {tech === 'Other' && (
            <input
              type="text"
              placeholder="Specify Tech..."
              value={customTech}
              onChange={(e) => setCustomTech(e.target.value)}
              className="mt-2 w-full p-2 border rounded text-sm"
            />
          )}
        </div>
      </div>

      <Button type="submit" disabled={!selectedFund}>Create Company</Button>
    </form>
  );
}
</file>

<file path='frontend/components/forms/PlanForm.tsx'>
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
    
    try {
      if (initialData) {
        // Update Mode: Can send pooling_fraction
        await api.updatePlan(initialData.id, {
          plan_name: name,
          start_month: startMonth,
          pooling_fraction: (poolingFraction / 100).toString(),
        });
      } else {
        // Create Mode: Strict payload { company_id, name, start_month, currency }
        await api.createPlan(selectedCompany, name, startMonth, currency);
      }
      
      if (!initialData) {
        setName('');
        setStartMonth('');
        setPoolingFraction(0);
        setSelectedCompany('');
        setCurrency('USD');
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
</file>


❌ API Error: 500 INTERNAL. {'error': {'code': 500, 'message': 'Internal error encountered.', 'status': 'INTERNAL'}}
