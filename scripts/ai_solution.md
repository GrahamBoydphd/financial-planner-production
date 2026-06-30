🤖 Generating architectural response via gemini-3.1-pro-preview...
<file path='frontend/components/forms/CompanyForm.tsx'>import { useState, useEffect } from 'react';
import { api, Fund, Company } from '@/lib/api';
import Button from '@/components/ui/Button';
import { DescriptionInput } from '@/components/forms/shared/DescriptionInput';

// --- IMT Options ---
const INDUSTRY_OPTIONS = [
  "Agriculture & Forestry", 
  "Food & Beverage", 
  "Textiles & Fashion", 
  "Wood & Paper", 
  "Chemicals & Plastics", 
  "Metals & Mining", 
  "Electronics", 
  "Machinery & Equipment", 
  "Automotive", 
  "Furniture", 
  "Construction", 
  "Real Estate", 
  "Waste & Water", 
  "Energy & Utilities", 
  "Logistics", 
  "ICT & Software", 
  "Professional Services", 
  "Retail & Trade", 
  "Healthcare", 
  "Tourism", "Other"
];



const MODEL_OPTIONS = [
  "SaaS / Subscription", 
  "Marketplace / Platform", 
  "Regenerative, Circular Design", 
  "Regenerative, Circular Inputs", 
  "Regenerative Sourcing",
  "Primary Material Sourcing",  
  "Product Life Extension", 
  "Primary Manufacturing", 
  "Remanufacturing / Refurbishment", 
  "Second-life / Repurposing", 
  "Material / Resource Recovery", 
  "Nutrient Recovery", 
  "Urban Mining", 
  "conventional Mining", 
  "Product-as-a-Service (PaaS)", 
  "Sharing Platforms", 
  "Digital Tools", 
  "Ecosystem Restoration", 
  "Carbon Sequestration",  
  "Other"
];

const TECH_OPTIONS = [
  "CleanTech", "AgriTech / Bio-Systems", 
  "Off-Grid / Decentralized",  
  "Web / Mobile", "Blockchain / ReFi", "Material Science", 
  "Blockchain / DLT", 
  "Internet of Things (IoT)", 
  "AI / Machine Learning", 
  "Digital Product Passports", 
  "Satellite Imagery & Remote Sensing", 
  "Digital Twins / Simulation Modeling", 
  "Chemical", 
  "Automated Sorting & Robotics", 
  "3D Printing (Additive Mfg)", 
  "Energy Storage & Battery Tech", 
  "Modular Construction", 
  "Precision Agriculture", 
  "Hydroponics/Aeroponics", 
  "Synthetic Biology (Bio-materials)", 
  "Biodegradable / Compostable Polymers", 
  "Conventional Polymers", 
  "Water Purification & Desalination", 
  "Other"
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
  const [description, setDescription] = useState('');

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
      setDescription(initialData.description || '');

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
      setDescription('');
      setIndustry(''); setCustomIndustry('');
      setModel(''); setCustomModel('');
      setTech(''); setCustomTech('');
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFund) return alert('Select a fund');
    
    // Word count validation
    const wordCount = description.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 200) {
      alert(`Description cannot exceed 200 words. Current: ${wordCount}`);
      return;
    }

    // Resolve "Other" fields
    const finalIndustry = industry === 'Other' ? customIndustry : industry;
    const finalModel = model === 'Other' ? customModel : model;
    const finalTech = tech === 'Other' ? customTech : tech;

    try {
      if (initialData) {
        await api.updateCompany(initialData.id, name, selectedFund, currency, description, finalIndustry, finalModel, finalTech);
      } else {
        await api.createCompany(name, selectedFund, currency, description, finalIndustry, finalModel, finalTech);
      }
      
      if (!initialData) {
        setName('');
        setCurrency('EUR');
        setDescription('');
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

      {/* Description */}
      <DescriptionInput
        value={description}
        onChange={setDescription}
        placeholder="Brief description of the company..."
      />

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
</file>

