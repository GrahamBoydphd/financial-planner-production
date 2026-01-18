🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
<file path='frontend/lib/api.ts'>
import axios from 'axios';

// If the environment variable is set (Production), use it.
// Otherwise, fall back to localhost (Development).
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// --- AXIOS INSTANCE (Auth Injection) ---
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Inject Token
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      console.log('DEBUG: Outgoing Token:', token);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    // Debugging headers
    console.log('Request Headers:', config.headers);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 & Debug 422
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Debugging 422 errors
      if (error.response.status === 422) {
        console.error("DEBUG 422 DETAIL:", error.response.data);
      }

      if (error.response.status === 401) {
        // Token expired or invalid
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          // Prevent redirect loops by not forcing reload/redirect here
          // window.location.href = '/login'; 
        }
      }
    }
    return Promise.reject(error);
  }
);

// --- INTERFACES ---
export interface AuthResponse {
  token: string;
  user_id: string;
  username: string;
  tenant_id: string;
}

export interface Fund {
  id: string;
  fund_name: string;
  currency_code?: string;
  created_at: string;
}

export interface Company {
  id: string;
  fund_id: string;
  company_name: string;
  currency_code: string;
  industry?: string;
  business_model?: string;
  technology?: string;
  created_at: string;
}

export interface FinancialPlan {
  id: string;
  company_id: string;
  plan_name: string;
  currency_code: string;
  start_month: string;
  initial_cash: string;
  pooling_fraction: string;
}

export interface UpdatePlanRequest {
  plan_name?: string;
  start_month?: string;
  initial_cash?: string;
  pooling_fraction?: string;
}

export interface RevenueItem {
  id: string;
  plan_id: string;
  revenue_name: string;
  source: string;
  initial_amount: string;
  growth_rate_percent: string;
  start_month: number;
  end_month?: number;
  frequency: string;
  cost_of_revenue_percent?: string;
  volatility_type?: string;
  vol_min?: string;
  vol_max?: string;
  vol_intervals?: number;
  vol_mean?: string;
  vol_scale?: string;
  vol_freedom?: string;
  vol_alpha?: string;
  vol_beta?: string;
}

export interface ExpenseItem {
  id: string;
  plan_id: string;
  expense_name: string;
  category: string;
  initial_amount: string;
  growth_rate_percent: string;
  start_month: number;
  end_month?: number;
  frequency: string;
  pct_of_revenue?: string;
  volatility_type?: string;
  vol_min?: string;
  vol_max?: string;
  vol_intervals?: number;
  vol_mean?: string;
  vol_scale?: string;
  vol_freedom?: string;
  vol_alpha?: string;
  vol_beta?: string;
}

export interface CapitalGrowthPolicy {
  id: string;
  plan_id: string;
  volatility_type: 'none' | 'flat' | 'student_t' | 'nrig';
  growth_rate_percent?: string;
  vol_min?: string;
  vol_max?: string;
  vol_intervals?: number;
  vol_mean?: string;
  vol_scale?: string;
  vol_freedom?: string;
  vol_alpha?: string;
  vol_beta?: string;
}

export interface CapitalInjection {
  id: string;
  plan_id: string;
  injection_name: string;
  amount: string; // Strict Type: String for Decimal precision
  month: number;
}

export interface DividendPolicy {
  id: string;
  plan_id: string;
  is_enabled: boolean;
  safety_threshold: string;
  payout_ratio: string;
}

export interface CreditFacility {
  id: string;
  plan_id: string;
  facility_limit: string;
  interest_rate: string;
  is_annual_rate: boolean;
}

export interface ValuationAssumption {
  id: string;
  plan_id: string;
  valuation_name: string;
  method: 'revenue' | 'ebitda';
  multiplier: string;
  date_applied: string;
}

export interface StaffingRole {
  id: string;
  plan_id: string;
  role_name: string;
  annual_salary: string;
  start_month: number;
  target_count: number; 
  hiring_plan: 'fixed_count' | 'monthly_rate'; 
  hiring_rate?: string; 
  annual_increase_percent: string;
}

export interface EventShock {
  id: string;
  shock_name: string;
  shock_month: number;
}

export interface MonthlyData {
  month_index: number;
  date: string;
  revenue: string;
  cogs: string;
  gross_profit: string;
  opex: string;
  interest_expense: string;
  net_income: string;
  cash_balance: string;
  dividend_paid: string;
  cumulative_dividends: string;
  cumulative_external_capital: string;
  cumulative_pool_received: string; 
  current_debt: string;
  total_value: string;
  is_solvent: boolean;
}

export interface SimulationResult {
  labels: string[];
  valuation_method: string;
  deterministic_data: MonthlyData[];
  single_run_data?: MonthlyData[];
  single_run_value?: string[];

  p0_value?: string[];
  p10_value?: string[];
  p25_value?: string[];
  p50_value?: string[];
  p75_value?: string[];
  p90_value?: string[];
  p100_value?: string[];

  p50_pool_cumulative?: string[]; 
  p50_data: MonthlyData[];
  survival_rate: number[];

  deterministic_runway?: number;
  deterministic_valuation: string;

  single_run_runway?: number;
  single_run_valuation?: string;

  p50_runway?: number;
  p50_valuation?: string;
}

// --- API OBJECT ---
export const api = {
  // AUTH
  login: async (username: string, password: string) => {
    const payload = { username, password };
    return (await apiClient.post<AuthResponse>('/api/auth/login', payload)).data;
  },
  
  register: async (username: string, email: string, password: string, full_name: string, company_name: string) => {
    const payload = { username, email, password, full_name, company_name };
    // Backend V2 returns 201 Created with no body (or ignored body).
    // We do not expect AuthResponse here anymore.
    await apiClient.post('/api/auth/register', payload);
  },

  // FUNDS
  getFunds: async () => (await apiClient.get<Fund[]>('/api/funds')).data,
  getFund: async (id: string) => (await apiClient.get<Fund>(`/api/funds/${id}`)).data,
  createFund: async (fund_name: string, currency_code: string) => 
    (await apiClient.post<Fund>('/api/funds', { fund_name, currency_code })).data,
  updateFund: async (id: string, fund_name: string, currency_code: string) => 
    (await apiClient.put<Fund>(`/api/funds/${id}`, { fund_name, currency_code })).data,
  deleteFund: async (id: string) => {
    await apiClient.delete(`/api/funds/${id}`);
  },

  // COMPANIES
  getCompanies: async () => (await apiClient.get<Company[]>('/api/companies')).data,
  getCompany: async (id: string) => (await apiClient.get<Company>(`/api/companies/${id}`)).data,
  createCompany: async (company_name: string, fund_id: string, currency_code: string, industry?: string, business_model?: string, technology?: string) => 
    (await apiClient.post<Company>('/api/companies', { company_name, fund_id, currency_code, industry, business_model, technology })).data,
  updateCompany: async (id: string, company_name: string, fund_id: string, currency_code: string, industry?: string, business_model?: string, technology?: string) => 
    (await apiClient.put<Company>(`/api/companies/${id}`, { company_name, fund_id, currency_code, industry, business_model, technology })).data,
  deleteCompany: async (id: string) => {
    await apiClient.delete(`/api/companies/${id}`);
  },  

  // PLANS
  getPlans: async () => (await apiClient.get<FinancialPlan[]>('/api/plans')).data,
  getPlan: async (id: string) => (await apiClient.get<FinancialPlan>(`/api/plans/${id}`)).data,
  // STRICT PAYLOAD: { company_id, plan_name, start_month, currency_code }
  createPlan: async (company_id: string, plan_name: string, start_month: string, currency_code: string) => {
    console.log("DEBUG: Payload:", { company_id, plan_name, start_month, currency_code });
    return (await apiClient.post<FinancialPlan>('/api/plans', { company_id, plan_name, start_month, currency_code })).data;
  },
  updatePlan: async (id: string, updates: UpdatePlanRequest) => 
    (await apiClient.put<FinancialPlan>(`/api/plans/${id}`, updates)).data,
  getProjection: async (planId: string, params?: { mode?: string, months?: number, stop_insolvency?: boolean, initial_cash?: number }) => 
    (await apiClient.get<SimulationResult>(`/api/plans/${planId}/projection`, { params })).data,

  // REVENUE
  getRevenueItems: async (planId: string) => (await apiClient.get<RevenueItem[]>(`/api/plans/${planId}/revenue`)).data,
  createRevenueItem: async (item: Omit<RevenueItem, 'id'>) => (await apiClient.post<RevenueItem>('/api/revenue', item)).data,
  updateRevenueItem: async (id: string, item: Partial<RevenueItem>) => (await apiClient.put<RevenueItem>(`/api/revenue/${id}`, item)).data,
  deleteRevenueItem: async (id: string) => (await apiClient.delete(`/api/revenue/${id}`)),

  // EXPENSES
  getExpenseItems: async (planId: string) => (await apiClient.get<ExpenseItem[]>(`/api/plans/${planId}/expenses`)).data,
  createExpenseItem: async (item: Omit<ExpenseItem, 'id'>) => (await apiClient.post<ExpenseItem>('/api/expenses', item)).data,
  updateExpenseItem: async (id: string, item: Partial<ExpenseItem>) => (await apiClient.put<ExpenseItem>(`/api/expenses/${id}`, item)).data,
  deleteExpenseItem: async (id: string) => (await apiClient.delete(`/api/expenses/${id}`)),

  // STAFFING
  getStaffingRoles: async (planId: string) => (await apiClient.get<StaffingRole[]>(`/api/plans/${planId}/staffing`)).data,
  createStaffingRole: async (role: Omit<StaffingRole, 'id'>) => (await apiClient.post<StaffingRole>('/api/staffing', role)).data,
  updateStaffingRole: async (role: Omit<StaffingRole, 'plan_id'> & { plan_id?: string }) => (await apiClient.put<StaffingRole>(`/api/staffing/${role.id}`, role)).data,
  deleteStaffingRole: async (id: string) => (await apiClient.delete(`/api/staffing/${id}`)).data,

  // CAPITAL GROWTH (Treasury)
  getCapitalGrowth: async (planId: string) => (await apiClient.get<CapitalGrowthPolicy>(`/api/plans/${planId}/capital-growth`)).data,
  upsertCapitalGrowth: async (item: Omit<CapitalGrowthPolicy, 'id'>) => 
    (await apiClient.post<CapitalGrowthPolicy>('/api/capital-growth', item)).data,

  // CAPITAL INJECTIONS
  getCapitalInjections: async (planId: string) => 
    (await apiClient.get<CapitalInjection[]>(`/api/plans/${planId}/capital`)).data,
  createCapitalInjection: async (item: Omit<CapitalInjection, 'id'>) => 
    (await apiClient.post<CapitalInjection>('/api/capital', item)).data,
  deleteCapitalInjection: async (id: string) => 
    (await apiClient.delete(`/api/capital/${id}`)),

  // DIVIDENDS
  getDividends: async (planId: string): Promise<DividendPolicy> => {
    try {
      const response = await apiClient.get<DividendPolicy>(`/api/plans/${planId}/dividends`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return {
          id: '',
          plan_id: planId,
          is_enabled: false,
          safety_threshold: '0',
          payout_ratio: '0',
        };
      }
      throw error;
    }
  },
  upsertDividends: async (item: Omit<DividendPolicy, 'id'>) => 
    (await apiClient.post<DividendPolicy>('/api/dividends', item)).data,

  // CREDIT
  getCredit: async (planId: string): Promise<CreditFacility> => {
    try {
      const response = await apiClient.get<CreditFacility>(`/api/plans/${planId}/credit`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return {
          id: '',
          plan_id: planId,
          facility_limit: '0',
          interest_rate: '0',
          is_annual_rate: true,
        };
      }
      throw error;
    }
  },
  upsertCredit: async (item: Omit<CreditFacility, 'id'>) => 
    (await apiClient.post<CreditFacility>('/api/credit', item)).data,

  // VALUATION
  getValuation: async (planId: string) => 
    (await apiClient.get<ValuationAssumption[]>(`/api/plans/${planId}/valuation`)).data,
  createValuation: async (item: { plan_id: string, valuation_name: string, method: string, multiplier: string, date_applied: string }) => 
    (await apiClient.post('/api/valuation', item)).data,
};
</file>

<file path='frontend/components/forms/FundForm.tsx'>
import { useState, useEffect } from 'react';
import { api, Fund } from '@/lib/api';
import Button from '@/components/ui/Button';

interface FundFormProps {
  onSuccess?: () => void;
  initialData?: Fund | null;
  onCancel?: () => void;
}

export default function FundForm({ onSuccess, initialData, onCancel }: FundFormProps) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    if (initialData) {
      setName(initialData.fund_name);
      setCurrency(initialData.currency_code || 'USD');
    } else {
      setName('');
      setCurrency('USD');
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (initialData) {
        await api.updateFund(initialData.id, name, currency);
      } else {
        await api.createFund(name, currency);
      }
      
      if (!initialData) {
        // Only clear if creating. If editing, we might want to keep state until parent clears it, 
        // but usually onSuccess triggers a refresh which might unmount or reset.
        // We'll clear for consistency.
        setName('');
        setCurrency('USD');
      }
      onSuccess?.();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to save fund');
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

      <div className="flex gap-2">
        <Button type="submit">{initialData ? 'Update Fund' : 'Create Fund'}</Button>
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

<file path='frontend/components/forms/CompanyForm.tsx'>
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
  const [currency, setCurrency] = useState('USD');

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
      setCurrency('USD');
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
        setCurrency('USD');
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

<file path='frontend/app/structure/page.tsx'>
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Edit2, Trash2, Eye } from 'lucide-react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import FundForm from '@/components/forms/FundForm';
import CompanyForm from '@/components/forms/CompanyForm';
import { api, Company, Fund } from '@/lib/api';

export default function StructurePage() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  
  // Edit State
  const [editingFund, setEditingFund] = useState<Fund | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const fetchData = async () => {
    try {
      const [f, c] = await Promise.all([api.getFunds(), api.getCompanies()]);
      setFunds(f);
      setCompanies(c);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteFund = async (id: string) => {
    if (!confirm("Are you sure you want to delete this fund? This action cannot be undone.")) return;
    try {
        await api.deleteFund(id); 
        fetchData();
    } catch (e) {
        console.error("Failed to delete fund", e);
        alert("Failed to delete fund.");
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (!confirm("Are you sure you want to delete this company? This action cannot be undone.")) return;
    try {
        await api.deleteCompany(id);
        fetchData();
    } catch (e) {
        console.error("Failed to delete company", e);
        alert("Failed to delete company.");
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-lg">
            <h1 className="text-3xl font-bold text-indigo-900 mb-2">Portfolio Structure</h1>
            <p className="text-indigo-700 mb-4">
                Define the hierarchy of your financial simulation. Create <strong>Funds</strong> to act as holding entities and <strong>Companies</strong> to model specific business ventures.
            </p>
            <div className="text-xs text-indigo-500 font-mono space-y-1">
                <p>This is an alpha release for early developmental testing, feedback, and educational purposes only.</p>
                <p>Note: Each company can currently be a member of one fund only.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Funds Section */}
          <div className="space-y-4">
            <Card>
              <h2 className="text-xl font-bold mb-4">
                {editingFund ? 'Edit Fund' : '1. Create Fund'}
              </h2>
              <FundForm 
                initialData={editingFund}
                onSuccess={() => { fetchData(); setEditingFund(null); }} 
                onCancel={() => setEditingFund(null)}
              />
            </Card>
            
            <div className="bg-white rounded shadow p-4">
              <h3 className="font-bold border-b pb-2 mb-2">Existing Funds</h3>
              {funds.length === 0 ? <p className="text-gray-500">No funds yet.</p> : (
                <div className="space-y-2">
                  {funds.map(f => (
                    <Link href={`/fund/${f.id}`} key={f.id} className="block group hover:bg-gray-50 rounded p-2 -mx-2 transition-colors">
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="font-medium text-gray-900 group-hover:text-blue-600">{f.fund_name}</span>
                                <span className="text-xs text-gray-400 font-mono ml-2">{f.id.slice(0,8)}...</span>
                            </div>
                            <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={(e) => { 
                                      e.preventDefault(); 
                                      setEditingFund(f);
                                      // Optional: Scroll to top if needed, but side-by-side layout usually visible
                                    }} 
                                    className="p-1 text-gray-400 hover:text-blue-600"
                                    title="Edit Fund"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button 
                                    onClick={(e) => { e.preventDefault(); handleDeleteFund(f.id); }} 
                                    className="p-1 text-gray-400 hover:text-red-600"
                                    title="Delete Fund"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Companies Section */}
          <div className="space-y-4">
            <Card id="add-company" className="scroll-mt-24">
              <h2 className="text-xl font-bold mb-4">
                {editingCompany ? 'Edit Company' : '2. Create Company'}
              </h2>
              <CompanyForm 
                initialData={editingCompany}
                funds={funds} 
                onSuccess={() => { fetchData(); setEditingCompany(null); }} 
                onCancel={() => setEditingCompany(null)}
              />
            </Card>

            <div className="bg-white rounded shadow p-4">
              <div className="flex justify-between items-center border-b pb-2 mb-2">
                  <h3 className="font-bold">Existing Companies</h3>
                  <Link href="/" className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded">
                    <Eye size={12} /> View Dashboard
                  </Link>
              </div>
              
              {companies.length === 0 ? <p className="text-gray-500">No companies yet.</p> : (
                <div className="space-y-2">
                  {companies.map(c => (
                    <Link href={`/company/${c.id}`} key={c.id} className="block group hover:bg-gray-50 rounded p-2 -mx-2 transition-colors">
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="font-medium text-gray-900 group-hover:text-blue-600">{c.company_name}</span>
                                <span className="text-gray-400 text-sm ml-2">[{c.currency_code}]</span>
                                <span className="text-xs text-gray-400 font-mono ml-2">{c.id.slice(0,8)}...</span>
                            </div>
                            <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={(e) => { 
                                      e.preventDefault(); 
                                      setEditingCompany(c);
                                      // Scroll to form if on mobile or small screen
                                      document.getElementById('add-company')?.scrollIntoView({ behavior: 'smooth' });
                                    }} 
                                    className="p-1 text-gray-400 hover:text-blue-600"
                                    title="Edit Company"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button 
                                    onClick={(e) => { e.preventDefault(); handleDeleteCompany(c.id); }} 
                                    className="p-1 text-gray-400 hover:text-red-600"
                                    title="Delete Company"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
</file>

