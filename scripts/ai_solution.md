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
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
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
          // Optional: Redirect to login if not already there
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
}

export interface Fund {
  id: string;
  name: string;
  created_at: string;
}

export interface Company {
  id: string;
  fund_id: string;
  name: string;
  industry?: string;
  business_model?: string;
  created_at: string;
}

export interface FinancialPlan {
  id: string;
  company_id: string;
  name: string;
  start_month: string;
  initial_cash: string;
  pooling_fraction: string;
}

export interface UpdatePlanRequest {
  name?: string;
  start_month?: string;
  initial_cash?: string;
  pooling_fraction?: string;
}

export interface RevenueItem {
  id: string;
  plan_id: string;
  name: string;
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
  name: string;
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
  name: string;
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
  name: string;
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
  annual_increase: string;
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
  is_insolvent: boolean;
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
    return (await apiClient.post<AuthResponse>('/api/auth/register', payload)).data;
  },

  // FUNDS
  getFunds: async () => (await apiClient.get<Fund[]>('/api/funds')).data,
  getFund: async (id: string) => (await apiClient.get<Fund>(`/api/funds/${id}`)).data,
  createFund: async (name: string) => 
    (await apiClient.post<Fund>('/api/funds', { name })).data,
  deleteFund: async (id: string) => {
    await apiClient.delete(`/api/funds/${id}`);
  },

  // COMPANIES
  getCompanies: async () => (await apiClient.get<Company[]>('/api/companies')).data,
  getCompany: async (id: string) => (await apiClient.get<Company>(`/api/companies/${id}`)).data,
  createCompany: async (name: string, fund_id: string, industry?: string, business_model?: string, technology?: string) => 
    (await apiClient.post<Company>('/api/companies', { name, fund_id, industry, business_model, technology })).data,
  deleteCompany: async (id: string) => {
    await apiClient.delete(`/api/companies/${id}`);
  },  

  // PLANS
  getPlans: async () => (await apiClient.get<FinancialPlan[]>('/api/plans')).data,
  getPlan: async (id: string) => (await apiClient.get<FinancialPlan>(`/api/plans/${id}`)).data,
  // STRICT PAYLOAD: { company_id, name, start_month }
  createPlan: async (company_id: string, name: string, start_month: string) => 
    (await apiClient.post<FinancialPlan>('/api/plans', { company_id, name, start_month })).data,
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
  getDividends: async (planId: string) => 
    (await apiClient.get<DividendPolicy>(`/api/plans/${planId}/dividends`)).data,
  upsertDividends: async (item: Omit<DividendPolicy, 'id'>) => 
    (await apiClient.post<DividendPolicy>('/api/dividends', item)).data,

  // CREDIT
  getCredit: async (planId: string) => 
    (await apiClient.get<CreditFacility>(`/api/plans/${planId}/credit`)).data,
  upsertCredit: async (item: Omit<CreditFacility, 'id'>) => 
    (await apiClient.post<CreditFacility>('/api/credit', item)).data,

  // VALUATION
  getValuation: async (planId: string) => 
    (await apiClient.get<ValuationAssumption[]>(`/api/plans/${planId}/valuation`)).data,
  createValuation: async (item: { plan_id: string, name: string, method: string, multiplier: string, date_applied: string }) => 
    (await apiClient.post('/api/valuation', item)).data,
};
</file>

<file path='frontend/components/forms/CapitalGrowthForm.tsx'>
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ALPHA_OPTIONS, BETA_OPTIONS, SCALE_OPTIONS } from '@/lib/presets';
import InfoTag from '@/components/ui/InfoTag';

interface Props {
  planId: string;
  onSuccess: () => void;
}

interface FormErrors {
  mean?: string;
  volMin?: string;
  volMax?: string;
  volIntervals?: string;
  alpha?: string;
  beta?: string;
  scale?: string;
  freedom?: string;
  general?: string;
}

export default function CapitalGrowthForm({ planId, onSuccess }: Props) {
  const [volType, setVolType] = useState('none');
  
  // Flat / Student-T / NRIG Params
  const [mean, setMean] = useState('');     // Mean / Mu / Growth Rate
  const [volMin, setVolMin] = useState(''); // Min
  const [volMax, setVolMax] = useState(''); // Max
  const [volIntervals, setVolIntervals] = useState('');
  
  // Specific NRIG / Student-T Params
  const [alpha, setAlpha] = useState('');
  const [beta, setBeta] = useState('');
  const [scale, setScale] = useState(''); // Delta / Scale
  const [freedom, setFreedom] = useState('');

  // UI State
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  
  // Active Strategy (Saved in DB)
  const [savedConfig, setSavedConfig] = useState<any>(null);

  useEffect(() => {
    let active = true;
    api.getCapitalGrowth(planId).then(p => {
      if (!active) return;
      setSavedConfig(p); // Store initial fetched config as "Active"

      const vType = (p.volatility_type || 'none').toLowerCase();
      setVolType(vType);
      
      // Handle rename: growth_rate_percent takes precedence, fallback to vol_mean
      const valMean = p.growth_rate_percent !== undefined ? p.growth_rate_percent.toString() : (p.vol_mean !== undefined ? p.vol_mean.toString() : "");
      setMean(valMean);

      setVolMin(p.vol_min !== undefined ? p.vol_min.toString() : '');
      setVolMax(p.vol_max !== undefined ? p.vol_max.toString() : '');
      setVolIntervals(p.vol_intervals !== undefined ? p.vol_intervals.toString() : '');
      
      setAlpha(p.vol_alpha !== undefined ? p.vol_alpha.toString() : '');
      setBeta(p.vol_beta !== undefined ? p.vol_beta.toString() : '');
      setScale(p.vol_scale !== undefined ? p.vol_scale.toString() : '');
      setFreedom(p.vol_freedom !== undefined ? p.vol_freedom.toString() : '');
    }).catch(() => {});
    return () => { active = false; };
  }, [planId]);

  const handleSave = async () => {
    setErrors({});
    const newErrors: FormErrors = {};

    // Validation
    if (volType !== 'none') {
        if (!mean) newErrors.mean = "Mean (Expected Monthly Return) is required.";
    }

    if (volType === 'flat') {
        if (!volMin) newErrors.volMin = "Min % is required.";
        if (!volMax) newErrors.volMax = "Max % is required.";
        if (!volIntervals) newErrors.volIntervals = "Intervals are required.";
        
        if (volMin && volMax && Number(volMin) >= Number(volMax)) {
            newErrors.volMin = "Min % must be less than Max %.";
        }
    } else if (volType === 'nrig') {
        if (!alpha) newErrors.alpha = "Alpha is required.";
        if (!beta) newErrors.beta = "Beta is required.";
        if (!scale) newErrors.scale = "Scale is required.";
    } else if (volType === 'student_t') {
        if (!scale) newErrors.scale = "Scale is required.";
        if (!freedom) newErrors.freedom = "Freedom is required.";
    }

    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
    }

    try {
        const payload = {
            plan_id: planId,
            volatility_type: volType.toLowerCase() as any,
            
            // Common / Student T / NRIG
            // RENAMED: vol_mean -> growth_rate_percent
            growth_rate_percent: mean ? String(mean) : undefined,
            
            // Flat Only
            vol_min: volType === 'flat' && volMin ? String(volMin) : undefined,
            vol_max: volType === 'flat' && volMax ? String(volMax) : undefined,
            vol_intervals: volType === 'flat' && volIntervals ? Number(volIntervals) : undefined,
            
            // NRIG Only
            vol_alpha: volType === 'nrig' && alpha ? String(alpha) : undefined,
            vol_beta: volType === 'nrig' && beta ? String(beta) : undefined,
            vol_scale: (volType === 'nrig' || volType === 'student_t') && scale ? String(scale) : undefined, 
            vol_freedom: volType === 'student_t' && freedom ? String(freedom) : undefined,
        };

        await api.upsertCapitalGrowth(payload);
        setSavedConfig(payload); // Update active strategy
        onSuccess();
    } catch (err) {
        setErrors({ general: "Failed to save configuration." });
    }
  };

  // Helper to find description
  const getAlphaDesc = () => ALPHA_OPTIONS.find(o => o.value.toString() === alpha)?.description;
  const getBetaDesc = () => BETA_OPTIONS.find(o => o.value.toString() === beta)?.description;
  const getScaleDesc = () => SCALE_OPTIONS.find(o => o.value.toString() === scale)?.description;

  // Render Summary Card Content
  const renderActiveStrategy = () => {
    if (!savedConfig) return "Loading...";
    const type = (savedConfig.volatility_type || 'none').toLowerCase();
    
    if (type === 'none') return "Standard (No Volatility)";

    // Handle rename in display
    const valMean = savedConfig.growth_rate_percent ?? savedConfig.vol_mean;
    let details = `Mean: ${valMean}%`;
    
    if (type === 'flat') {
        details += `, Range: ${savedConfig.vol_min}% to ${savedConfig.vol_max}%`;
    } else if (type === 'student_t') {
        details += `, Scale: ${savedConfig.vol_scale}, DoF: ${savedConfig.vol_freedom}`;
    } else if (type === 'nrig') {
        details += `, α: ${savedConfig.vol_alpha}, β: ${savedConfig.vol_beta}, δ: ${savedConfig.vol_scale}`;
    }

    const typeLabel = type === 'student_t' ? 'Student-T' : type.toUpperCase();
    return `Active Strategy: ${typeLabel} (${details})`;
  };

  return (
    <div className="space-y-3">
        <div className="flex justify-between items-center">
            <label className="text-xs text-gray-500 block">Investment Strategy (Risk Model)</label>
             {volType !== 'none' && (
                 <button type="button" onClick={() => setIsAdvanced(!isAdvanced)} className="text-xs text-indigo-600 underline">
                     {isAdvanced ? 'Switch to Simple Mode' : 'Switch to Advanced Mode'}
                 </button>
             )}
        </div>

        <div>
            <select className="w-full border p-2 rounded text-sm" value={volType} onChange={e => setVolType(e.target.value)}>
                <option value="none" disabled hidden>-- Select Risk Model --</option>
                <option value="flat">Simple volatility (min/max)</option>
                <option value="nrig">Comprehensive volatility</option>
                <option value="student_t">Student's t distribution</option>
            </select>
        </div>

        {volType !== 'none' && (
            <div className="bg-indigo-50 p-3 rounded text-sm space-y-3">
                 
                 {/* MEAN / MU - Common (Always Visible) */}
                 <div>
                    <label className="text-xs text-gray-500">Expected Monthly Return (Mean %)</label>
                    <input 
                        type="number" 
                        step="0.01" 
                        className={`w-full border p-1 ${errors.mean ? 'border-red-500' : ''}`} 
                        value={mean} 
                        onChange={e => setMean(e.target.value)} 
                        placeholder="e.g. 0.5" 
                    />
                    {errors.mean && <p className="text-red-500 text-xs mt-1">{errors.mean}</p>}
                 </div>

                 {/* SIMPLE MODE DROPDOWNS (NRIG Only) */}
                 {!isAdvanced && volType === 'nrig' && (
                     <div className="space-y-3">
                         <div>
                             <div className="flex items-center mb-1">
                                <label className="text-xs text-gray-500">Likelyhood of outliers (tail weight)</label>
                                <InfoTag content="Controls likelihood of extreme events. High = predictable, Low = more outliers." />
                             </div>
                             <select 
                                className={`w-full border p-1 rounded text-xs ${errors.alpha ? 'border-red-500' : ''}`} 
                                value={alpha} 
                                onChange={e => setAlpha(e.target.value)}
                             >
                                 <option value="">-- Select --</option>
                                 {ALPHA_OPTIONS.map(o => (
                                     <option key={o.value} value={o.value}>{o.label}</option>
                                 ))}
                             </select>
                             {errors.alpha && <p className="text-red-500 text-xs mt-1">{errors.alpha}</p>}
                             <p className="text-xs text-gray-400 italic mt-1">{getAlphaDesc()}</p>
                         </div>

                         <div>
                             <div className="flex items-center mb-1">
                                <label className="text-xs text-gray-500">Volatility imbalance (downside / upside tail is fatter)</label>
                                <InfoTag content="Controls skewness. Balances risk towards upside or downside." />
                             </div>
                             <select 
                                className={`w-full border p-1 rounded text-xs ${errors.beta ? 'border-red-500' : ''}`} 
                                value={beta} 
                                onChange={e => setBeta(e.target.value)}
                             >
                                 <option value="">-- Select --</option>
                                 {BETA_OPTIONS.map(o => (
                                     <option key={o.value} value={o.value}>{o.label}</option>
                                 ))}
                             </select>
                             {errors.beta && <p className="text-red-500 text-xs mt-1">{errors.beta}</p>}
                             <p className="text-xs text-gray-400 italic mt-1">{getBetaDesc()}</p>
                         </div>

                         <div>
                             <div className="flex items-center mb-1">
                                <label className="text-xs text-gray-500">Delta/Scale (Volatility)</label>
                                <InfoTag content="Scales volatility. High = volatile, Low = stable." />
                             </div>
                             <select 
                                className={`w-full border p-1 rounded text-xs ${errors.scale ? 'border-red-500' : ''}`} 
                                value={scale} 
                                onChange={e => setScale(e.target.value)}
                             >
                                 <option value="">-- Select --</option>
                                 {SCALE_OPTIONS.map(o => (
                                     <option key={o.value} value={o.value}>{o.label}</option>
                                 ))}
                             </select>
                             {errors.scale && <p className="text-red-500 text-xs mt-1">{errors.scale}</p>}
                             <p className="text-xs text-gray-400 italic mt-1">{getScaleDesc()}</p>
                         </div>
                     </div>
                 )}

                 {/* ADVANCED INPUTS */}
                 {(isAdvanced || volType !== 'nrig') && (
                     <>
                        {/* FLAT PARAMETERS */}
                        {volType === 'flat' && (
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-xs text-gray-400">Min %</label>
                                    <input 
                                        className={`w-full border p-1 ${errors.volMin ? 'border-red-500' : ''}`} 
                                        value={volMin} 
                                        onChange={e => setVolMin(e.target.value)} 
                                    />
                                    {errors.volMin && <p className="text-red-500 text-xs">{errors.volMin}</p>}
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Max %</label>
                                    <input 
                                        className={`w-full border p-1 ${errors.volMax ? 'border-red-500' : ''}`} 
                                        value={volMax} 
                                        onChange={e => setVolMax(e.target.value)} 
                                    />
                                    {errors.volMax && <p className="text-red-500 text-xs">{errors.volMax}</p>}
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Steps</label>
                                    <input 
                                        className={`w-full border p-1 ${errors.volIntervals ? 'border-red-500' : ''}`} 
                                        value={volIntervals} 
                                        onChange={e => setVolIntervals(e.target.value)} 
                                    />
                                    {errors.volIntervals && <p className="text-red-500 text-xs">{errors.volIntervals}</p>}
                                </div>
                            </div>
                        )}

                        {/* STUDENT-T PARAMETERS */}
                        {volType === 'student_t' && (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-gray-400">Scale (Vol)</label>
                                    <input 
                                        className={`w-full border p-1 ${errors.scale ? 'border-red-500' : ''}`} 
                                        value={scale} 
                                        onChange={e => setScale(e.target.value)} 
                                        placeholder="e.g. 1.0" 
                                    />
                                    {errors.scale && <p className="text-red-500 text-xs">{errors.scale}</p>}
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Freedom (Deg)</label>
                                    <input 
                                        className={`w-full border p-1 ${errors.freedom ? 'border-red-500' : ''}`} 
                                        value={freedom} 
                                        onChange={e => setFreedom(e.target.value)} 
                                        placeholder="e.g. 5.0" 
                                    />
                                    {errors.freedom && <p className="text-red-500 text-xs">{errors.freedom}</p>}
                                </div>
                            </div>
                        )}

                        {/* NRIG PARAMETERS (Advanced) */}
                        {volType === 'nrig' && (
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <div className="flex items-center mb-1">
                                        <label className="text-xs text-gray-400">Likelyhood of outliers (Alpha)</label>
                                        <InfoTag content="Controls likelihood of extreme events. High = predictable, Low = more outliers." />
                                    </div>
                                    <input 
                                        className={`w-full border p-1 ${errors.alpha ? 'border-red-500' : ''}`} 
                                        value={alpha} 
                                        onChange={e => setAlpha(e.target.value)} 
                                        placeholder="e.g. 1.0" 
                                    />
                                    {errors.alpha && <p className="text-red-500 text-xs">{errors.alpha}</p>}
                                </div>
                                <div>
                                    <div className="flex items-center mb-1">
                                        <label className="text-xs text-gray-400">Imbalance (Beta)</label>
                                        <InfoTag content="Controls skewness. Balances risk towards upside or downside." />
                                    </div>
                                    <input 
                                        className={`w-full border p-1 ${errors.beta ? 'border-red-500' : ''}`} 
                                        value={beta} 
                                        onChange={e => setBeta(e.target.value)} 
                                        placeholder="e.g. 0.0" 
                                    />
                                    {errors.beta && <p className="text-red-500 text-xs">{errors.beta}</p>}
                                </div>
                                <div>
                                    <div className="flex items-center mb-1">
                                        <label className="text-xs text-gray-400">Delta (Scale)</label>
                                        <InfoTag content="Scales volatility. High = volatile, Low = stable." />
                                    </div>
                                    <input 
                                        className={`w-full border p-1 ${errors.scale ? 'border-red-500' : ''}`} 
                                        value={scale} 
                                        onChange={e => setScale(e.target.value)} 
                                        placeholder="e.g. 1.0" 
                                    />
                                    {errors.scale && <p className="text-red-500 text-xs">{errors.scale}</p>}
                                </div>
                            </div>
                        )}
                     </>
                 )}

                 <p className="text-xs text-gray-400">
                    Calculated on positive cash balance at month end.
                 </p>
            </div>
        )}

        {errors.general && <div className="text-red-600 text-xs font-semibold">{errors.general}</div>}

        {/* Summary Card */}
        <div className="mt-4 p-3 bg-gray-100 rounded border text-xs">
            <h4 className="font-bold text-gray-700 mb-1">Active Policy Summary</h4>
            <div className="text-gray-600">
                {renderActiveStrategy()}
            </div>
        </div>

        <button onClick={handleSave} className="w-full bg-indigo-600 text-white py-1 rounded text-sm font-bold">Update Investment Policy</button>
    </div>
  );
}
</file>

