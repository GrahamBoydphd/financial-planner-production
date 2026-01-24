import { useState, useEffect } from 'react';
import { api, Fund, Company } from '@/lib/api';
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

interface CompanyFormProps {
  onSuccess?: () => void;
  funds?: Fund[];
  initialData?: Company | null;
  onCancel?: () => void;
}

export default function CompanyForm({ onSuccess, funds = [], initialData, onCancel }: CompanyFormProps) {
  const [name, setName] = useState('');
  const [selectedFund, setSelectedFund] = useState('');
  const [currency, setCurrency] = useState('EUR');

  // IMT State
  const [industry, setIndustry] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
  
  const [model, setModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  
  const [tech, setTech] = useState('');
  const [customTech, setCustomTech] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.company_name);
      setSelectedFund(initialData.fund_id);
      setCurrency(initialData.currency_code);

      // Helper to set select/custom fields
      const setField = (value: string | undefined, options: string[], setSelect: any, setCustom: any) => {
        if (!value) {
          setSelect('');
          setCustom('');
          return;
        }
        if (options.includes(value)) {
          setSelect(value);
          setCustom('');
        } else {
          setSelect('Other');
          setCustom(value);
        }
      };

      setField(initialData.industry, INDUSTRY_OPTIONS, setIndustry, setCustomIndustry);
      setField(initialData.business_model, MODEL_OPTIONS, setModel, setCustomModel);
      setField(initialData.technology, TECH_OPTIONS, setTech, setCustomTech);

    } else {
      setName('');
      setSelectedFund('');
      setCurrency('EUR');
      setIndustry(''); setCustomIndustry('');
      setModel(''); setCustomModel('');
      setTech(''); setCustomTech('');
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFund) return alert('Select a fund');
    
    // Resolve "Other" fields
    const finalIndustry = industry === 'Other' ? customIndustry : industry;
    const finalModel = model === 'Other' ? customModel : model;
    const finalTech = tech === 'Other' ? customTech : tech;

    try {
      if (initialData) {
        await api.updateCompany(initialData.id, name, selectedFund, currency, finalIndustry, finalModel, finalTech);
      } else {
        await api.createCompany(name, selectedFund, currency, finalIndustry, finalModel, finalTech);
      }
      
      if (!initialData) {
        setName('');
        setCurrency('EUR');
        setIndustry(''); setCustomIndustry('');
        setModel(''); setCustomModel('');
        setTech(''); setCustomTech('');
      }
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      alert('Failed to save company');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold text-gray-800">
        {initialData ? 'Edit Company' : 'New Company'}
      </h3>
      
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
          disabled
          className="w-full p-2 border rounded bg-gray-100 text-gray-500 cursor-not-allowed"
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

      <div className="flex gap-2">
        <Button type="submit" disabled={!selectedFund}>
          {initialData ? 'Update Company' : 'Create Company'}
        </Button>
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
