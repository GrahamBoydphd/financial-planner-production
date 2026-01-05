import axios from 'axios';

// If the environment variable is set (Production), use it.
// Otherwise, fall back to localhost (Development).
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// --- INTERFACES ---
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
  initial_cash: number;
  pooling_fraction: number;
}

export interface UpdatePlanRequest {
  name?: string;
  start_month?: string;
  initial_cash?: number;
  pooling_fraction?: number;
}

export interface RevenueItem {
  id: string;
  plan_id: string;
  name: string;
  source: string;
  initial_amount: number;
  growth_rate_percent: number;
  start_month: number;
  end_month?: number;
  frequency: string;
  cost_of_revenue_percent?: number;
  volatility_type?: string;
  vol_min?: number;
  vol_max?: number;
  vol_intervals?: number;
  vol_mean?: number;
  vol_scale?: number;
  vol_freedom?: number;
  vol_alpha?: number;
  vol_beta?: number;
}

export interface ExpenseItem {
  id: string;
  plan_id: string;
  name: string;
  category: string;
  initial_amount: number;
  growth_rate_percent: number;
  start_month: number;
  end_month?: number;
  frequency: string;
  pct_of_revenue?: number;
  volatility_type?: string;
  vol_min?: number;
  vol_max?: number;
  vol_intervals?: number;
  vol_mean?: number;
  vol_scale?: number;
  vol_freedom?: number;
  vol_alpha?: number;
  vol_beta?: number;
}

export interface CapitalGrowthPolicy {
  id: string;
  plan_id: string;
  volatility_type: 'none' | 'flat' | 'student_t' | 'nrig';
  vol_min?: number;
  vol_max?: number;
  vol_intervals?: number;
  vol_mean?: number;
  vol_scale?: number;
  vol_freedom?: number;
  vol_alpha?: number;
  vol_beta?: number;
}

export interface CapitalInjection {
  id: string;
  plan_id: string;
  name: string;
  amount: number;
  month: number;
}

export interface DividendPolicy {
  id: string;
  plan_id: string;
  is_enabled: boolean;
  safety_threshold: number;
  payout_ratio: number;
}

export interface CreditFacility {
  id: string;
  plan_id: string;
  facility_limit: number;
  interest_rate: number;
  is_annual_rate: boolean;
}

export interface ValuationAssumption {
  id: string;
  plan_id: string;
  name: string;
  method: 'revenue' | 'ebitda';
  multiplier: number;
  date_applied: string;
}

export interface StaffingRole {
  id: string;
  plan_id: string;
  role_name: string;
  annual_salary: number;
  start_month: number;
  target_count: number; // Renamed from count
  hiring_plan: 'fixed_count' | 'monthly_rate'; // New
  hiring_rate?: number; // New
  annual_increase: number;
}

export interface MonthlyData {
  month_index: number;
  date: string;
  revenue: number | string;
  cogs: number | string;
  gross_profit: number | string;
  opex: number | string;
  interest_expense: number | string;
  net_income: number | string;
  cash_balance: number | string;
  dividend_paid: number | string;
  cumulative_dividends: number | string;
  cumulative_external_capital: number | string;
  cumulative_pool_received: number | string; // Added field
  current_debt: number | string;
  total_value: number | string;
  is_insolvent: boolean;
}

export interface SimulationResult {
  labels: string[];
  valuation_method: string;
  deterministic_data: MonthlyData[];
  single_run_data?: MonthlyData[];
  single_run_value?: (number | string)[];

  p0_value?: (number | string)[];
  p10_value?: (number | string)[];
  p25_value?: (number | string)[];
  p50_value?: (number | string)[];
  p75_value?: (number | string)[];
  p90_value?: (number | string)[];
  p100_value?: (number | string)[];

  p50_pool_cumulative?: (number | string)[]; // Added field

  deterministic_runway?: number;
  deterministic_valuation: number | string;

  single_run_runway?: number;
  single_run_valuation?: number | string;

  p50_runway?: number;
  p50_valuation?: number | string;
}

// --- API OBJECT ---
export const api = {
  // FUNDS
  getFunds: async () => (await axios.get<Fund[]>(`${API_URL}/api/funds`)).data,
  getFund: async (id: string) => (await axios.get<Fund>(`${API_URL}/api/funds/${id}`)).data,
  createFund: async (name: string, user_id: string) => 
    (await axios.post<Fund>(`${API_URL}/api/funds`, { name, user_id })).data,

  // COMPANIES
  getCompanies: async () => (await axios.get<Company[]>(`${API_URL}/api/companies`)).data,
  getCompany: async (id: string) => (await axios.get<Company>(`${API_URL}/api/companies/${id}`)).data,
  createCompany: async (name: string, fund_id: string, industry?: string, business_model?: string, technology?: string) => 
    (await axios.post<Company>(`${API_URL}/api/companies`, { name, fund_id, industry, business_model, technology })).data,

  // PLANS
  getPlans: async () => (await axios.get<FinancialPlan[]>(`${API_URL}/api/plans`)).data,
  getPlan: async (id: string) => (await axios.get<FinancialPlan>(`${API_URL}/api/plans/${id}`)).data,
  createPlan: async (company_id: string, name: string, start_month: string) => 
    (await axios.post<FinancialPlan>(`${API_URL}/api/plans`, { company_id, name, start_month })).data,
  updatePlan: async (id: string, updates: UpdatePlanRequest) => 
    (await axios.put<FinancialPlan>(`${API_URL}/api/plans/${id}`, updates)).data,
  getProjection: async (planId: string, params?: { mode?: string, months?: number, stop_insolvency?: boolean, initial_cash?: number }) => 
    (await axios.get<SimulationResult>(`${API_URL}/api/plans/${planId}/projection`, { params })).data,

  // REVENUE
  getRevenueItems: async (planId: string) => (await axios.get<RevenueItem[]>(`${API_URL}/api/plans/${planId}/revenue`)).data,
  createRevenueItem: async (item: Omit<RevenueItem, 'id'>) => (await axios.post<RevenueItem>(`${API_URL}/api/revenue`, item)).data,
  updateRevenueItem: async (id: string, item: Partial<RevenueItem>) => (await axios.put<RevenueItem>(`${API_URL}/api/revenue/${id}`, item)).data,
  deleteRevenueItem: async (id: string) => (await axios.delete(`${API_URL}/api/revenue/${id}`)),

  // EXPENSES
  getExpenseItems: async (planId: string) => (await axios.get<ExpenseItem[]>(`${API_URL}/api/plans/${planId}/expenses`)).data,
  createExpenseItem: async (item: Omit<ExpenseItem, 'id'>) => (await axios.post<ExpenseItem>(`${API_URL}/api/expenses`, item)).data,
  updateExpenseItem: async (id: string, item: Partial<ExpenseItem>) => (await axios.put<ExpenseItem>(`${API_URL}/api/expenses/${id}`, item)).data,
  deleteExpenseItem: async (id: string) => (await axios.delete(`${API_URL}/api/expenses/${id}`)),

  // STAFFING
  getStaffingRoles: async (planId: string) => (await axios.get<StaffingRole[]>(`${API_URL}/api/plans/${planId}/staffing`)).data,
  createStaffingRole: async (role: Omit<StaffingRole, 'id'>) => (await axios.post<StaffingRole>(`${API_URL}/api/staffing`, role)).data,
  updateStaffingRole: async (role: Omit<StaffingRole, 'plan_id'> & { plan_id?: string }) => (await axios.put<StaffingRole>(`${API_URL}/api/staffing/${role.id}`, role)).data,
  deleteStaffingRole: async (id: string) => (await axios.delete(`${API_URL}/api/staffing/${id}`)).data,

  // CAPITAL GROWTH (Treasury)
  getCapitalGrowth: async (planId: string) => (await axios.get<CapitalGrowthPolicy>(`${API_URL}/api/plans/${planId}/capital-growth`)).data,
  upsertCapitalGrowth: async (item: Omit<CapitalGrowthPolicy, 'id'>) => 
    (await axios.post<CapitalGrowthPolicy>(`${API_URL}/api/capital-growth`, item)).data,

  // CAPITAL INJECTIONS
  getCapitalInjections: async (planId: string) => 
    (await axios.get<CapitalInjection[]>(`${API_URL}/api/plans/${planId}/capital`)).data,
  createCapitalInjection: async (item: Omit<CapitalInjection, 'id'>) => 
    (await axios.post<CapitalInjection>(`${API_URL}/api/capital`, item)).data,
  deleteCapitalInjection: async (id: string) => 
    (await axios.delete(`${API_URL}/api/capital/${id}`)),

  // DIVIDENDS
  getDividends: async (planId: string) => 
    (await axios.get<DividendPolicy>(`${API_URL}/api/plans/${planId}/dividends`)).data,
  upsertDividends: async (item: Omit<DividendPolicy, 'id'>) => 
    (await axios.post<DividendPolicy>(`${API_URL}/api/dividends`, item)).data,

  // CREDIT
  getCredit: async (planId: string) => 
    (await axios.get<CreditFacility>(`${API_URL}/api/plans/${planId}/credit`)).data,
  upsertCredit: async (item: Omit<CreditFacility, 'id'>) => 
    (await axios.post<CreditFacility>(`${API_URL}/api/credit`, item)).data,

  // VALUATION
  getValuation: async (planId: string) => 
    (await axios.get<ValuationAssumption[]>(`${API_URL}/api/plans/${planId}/valuation`)).data,
  createValuation: async (item: { plan_id: string, name: string, method: string, multiplier: number, date_applied: string }) => 
    (await axios.post(`${API_URL}/api/valuation`, item)).data,
    
  // --- DELETE METHODS ---
  deleteFund: async (id: string) => {
    const res = await fetch(`${API_URL}/api/funds/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete fund');
  },

  deleteCompany: async (id: string) => {
    const res = await fetch(`${API_URL}/api/companies/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete company');
  },  
};
