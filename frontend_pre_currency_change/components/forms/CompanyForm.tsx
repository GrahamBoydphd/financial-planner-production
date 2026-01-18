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

interface Props {
  onSuccess?: () => void;
  funds?: Fund[];
  initialData?: Company;
  onCancel?: () => void;
}

export default function CompanyForm({ onSuccess, funds = [], initialData, onCancel }: Props) {
  const [name, setName] = useState('');
  const [selectedFund, setSelectedFund] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');

  // IMT State
  const [industry, setIndustry] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
  
  const [model, setModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  
  const [tech, setTech] = useState('');
  const [customTech, setCustomTech] = useState('');

  // Initialize state from initialData
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setSelectedFund(initialData.fund_id);
      setCurrencyCode(initialData.currency_code || 'USD');

      // Parse Industry
      if (initialData.industry) {
        if (INDUSTRY_OPTIONS.includes(initialData.industry)) {
          setIndustry(initialData.industry);
          setCustomIndustry('');
        } else {
          setIndustry('Other');
          setCustomIndustry(initialData.industry);
        }
      } else {
        setIndustry('');
        setCustomIndustry('');
      }

      // Parse Model
      if (initialData.business_model) {
        if (MODEL_OPTIONS.includes(initialData.business_model)) {
          setModel(initialData.business_model);
          setCustomModel('');
        } else {
          setModel('Other');
          setCustomModel(initialData.business_model);
        }
      } else {
        setModel('');
        setCustomModel('');
      }

      // Parse Tech
      if (initialData.technology) {
        if (TECH_OPTIONS.includes(initialData.technology)) {
          setTech(initialData.technology);
          setCustomTech('');
        } else {
          setTech('Other');
          setCustomTech(initialData.technology);
        }
      } else {
        setTech('');
        setCustomTech('');
      }
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
        await api.updateCompany(initialData.id, {
          name,
          fund_id: selectedFund,
          industry: finalIndustry,
          business_model: finalModel,
          technology: finalTech,
          currency_code: currencyCode
        });
      } else {
        await api.createCompany(name, selectedFund, finalIndustry, finalModel, finalTech, currencyCode);
      }

      if (!initialData) {
        setName('');
        setIndustry(''); setCustomIndustry('');
        setModel(''); setCustomModel('');
        setTech(''); setCustomTech('');
        setCurrencyCode('USD');
      }
      
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      alert(`Failed to ${initialData ? 'update' : 'create'} company`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded shadow">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">{initialData ? 'Edit Company' : 'New Company'}</h3>
        {initialData && onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-red-500 hover:underline">Cancel</button>
        )}
      </div>
      
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
            <option key={f.id} value={f.id}>{f.name}</option>
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
          value={currencyCode}
          onChange={(e) => setCurrencyCode(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="USD">USD ($)</option>
          <option value="GBP">GBP (£)</option>
          <option value="EUR">EUR (€)</option>
          <option value="JPY">JPY (¥)</option>
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

      <Button type="submit" disabled={!selectedFund}>{initialData ? 'Update Company' : 'Create Company'}</Button>
    </form>
  );
}
