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
