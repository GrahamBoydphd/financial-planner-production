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
      await api.createCompany(name, selectedFund, finalIndustry, finalModel, finalTech);
      setName('');
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
