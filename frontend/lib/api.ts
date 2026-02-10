import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- HELPER: GET TENANT ID ---
const getTenantId = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('tenant_id');
  }
  return null;
};

// --- INTERCEPTOR (CRITICAL FOR AUTH) ---
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

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('tenant_id'); // Clear tenant on 401
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

export interface FundPlan {
  id: string;
  fund_id: string;
  plan_name: string;
  selected_plans: Record<string, string>; 
  created_at?: string;
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
  insolvency_threshold?: string;
}

export interface UpdatePlanRequest {
  plan_name?: string;
  start_month?: string;
  initial_cash?: string;
  pooling_fraction?: string;
  insolvency_threshold?: string;
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
  target_mean?: string;
  vol_input_mode?: 'simple' | 'advanced';
  vol_mode?: 'simple' | 'advanced';
  vol_fatness_level?: string;
  vol_skew_level?: string;
  vol_width_level?: string;
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
  target_mean?: string;
  vol_input_mode?: 'simple' | 'advanced';
  vol_mode?: 'simple' | 'advanced';
  vol_fatness_level?: string;
  vol_skew_level?: string;
  vol_width_level?: string;
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
  target_mean?: string;
  vol_input_mode?: 'simple' | 'advanced';
  vol_mode?: 'simple' | 'advanced';
  vol_fatness_level?: string;
  vol_skew_level?: string;
  vol_width_level?: string;
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
  amount: string;
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
  solvent_companies?: number;
  total_companies?: number;
  treasury_gain?: string;
  // Pooling Flows
  pool_contribution?: string;
  pool_received?: string;
  contributing_companies?: number;
  total_exposure?: string;
}

export interface SimulationResult {
  labels: string[];
  valuation_method: string;
  deterministic_data: MonthlyData[];
  single_run_data?: MonthlyData[];
  single_run_value?: string[];

  p0_value?: string[];
  p5_value?: string[];
  p10_value?: string[];
  p25_value?: string[];
  p50_value?: string[];
  p75_value?: string[];
  p90_value?: string[];
  p95_value?: string[];
  p100_value?: string[];

  // Solvency Counts (Optional)
  p0_solvent_count?: number[];
  p10_solvent_count?: number[];
  p25_solvent_count?: number[];
  p50_solvent_count?: number[];
  p75_solvent_count?: number[];
  p90_solvent_count?: number[];
  p100_solvent_count?: number[];

  all_paths?: MonthlyData[][];

  p50_pool_cumulative?: string[]; 
  p50_data: MonthlyData[];
  survival_rate: number[];

  deterministic_runway?: number;
  deterministic_valuation: string;
  single_run_runway?: number;
  single_run_valuation?: string;
  p50_runway?: number;
  p50_valuation?: string;

  average_event_count?: number;

  // Error reporting
  errors?: string[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  industry: string;
  complexity: string;
}

export interface SwanEvent {
  id: string;
  event_name: string;
  event_type: string;
  scope: 'global' | 'local';
  target_ids: string[];
  fund_ids?: string[];
  company_ids?: string[];
  occurrence_probability: string;
  magnitude: string;
  direction: string;
  duration: string;
  is_counter_cyclic?: boolean;
}

// --- API METHODS ---

export const api = {
  // AUTH
  login: async (username: string, password: string) => {
    const payload = { username, password };
    const response = await apiClient.post<AuthResponse>('/api/auth/login', payload);
    // Save Tenant ID immediately upon login
    if (typeof window !== 'undefined' && response.data.tenant_id) {
      localStorage.setItem('tenant_id', response.data.tenant_id);
    }
    return response.data;
  },
  
  register: async (username: string, email: string, password: string, full_name: string, company_name: string) => {
    const payload = { username, email, password, full_name, company_name };
    await apiClient.post('/api/auth/register', payload);
  },

  // FUNDS
  getFunds: async () => (await apiClient.get<Fund[]>('/api/funds')).data,
  getFund: async (id: string) => (await apiClient.get<Fund>(`/api/funds/${id}`)).data,
  
  createFund: async (fund_name: string, currency_code: string) => 
    (await apiClient.post<Fund>('/api/funds', { 
      fund_name, 
      currency_code,
      tenant_id: getTenantId() 
    })).data,
    
  updateFund: async (id: string, fund_name: string, currency_code: string) => 
    (await apiClient.put<Fund>(`/api/funds/${id}`, { fund_name, currency_code })).data,
  deleteFund: async (id: string) => {
    await apiClient.delete(`/api/funds/${id}`);
  },

  // FUND PLANS (V4)
  getFundPlans: async (fundId: string) => (await apiClient.get<FundPlan[]>(`/api/funds/${fundId}/plans`)).data,
  
  createFundPlan: async (data: { fund_id: string, plan_name: string, selected_plans: Record<string, string> }) =>
    (await apiClient.post<FundPlan>(`/api/funds/${data.fund_id}/plans`, {
      ...data,
      tenant_id: getTenantId()
    })).data,
    
  updateFundPlan: async (id: string, data: { plan_name: string, selected_plans: Record<string, string> }) =>
    (await apiClient.put<FundPlan>(`/api/funds/plans/${id}`, data)).data,
    
  deleteFundPlan: async (id: string) => (await apiClient.delete(`/api/funds/plans/${id}`)),

  // FUND SIMULATION
  getFundSimulation: async (fundId: string, params?: { 
    fund_plan_id?: string, 
    fund_pooling_fraction?: string, 
    months?: number, 
    stop_insolvency?: boolean,
    include_initial_capital?: boolean,
    events_active?: boolean
  }) => 
    (await apiClient.get<SimulationResult>(`/api/funds/${fundId}/simulation`, { params })).data,

  // COMPANIES
  getCompanies: async () => (await apiClient.get<Company[]>('/api/companies')).data,
  getCompany: async (id: string) => (await apiClient.get<Company>(`/api/companies/${id}`)).data,
  
  createCompany: async (company_name: string, fund_id: string, currency_code: string, industry?: string, business_model?: string, technology?: string) => 
    (await apiClient.post<Company>('/api/companies', { 
      company_name, 
      fund_id, 
      currency_code, 
      industry, 
      business_model, 
      technology,
      tenant_id: getTenantId()
    })).data,
    
  updateCompany: async (id: string, company_name: string, fund_id: string, currency_code: string, industry?: string, business_model?: string, technology?: string) => 
    (await apiClient.put<Company>(`/api/companies/${id}`, { company_name, fund_id, currency_code, industry, business_model, technology })).data,
  deleteCompany: async (id: string) => {
    await apiClient.delete(`/api/companies/${id}`);
  },  

  // PLANS
  getPlans: async () => (await apiClient.get<FinancialPlan[]>('/api/plans')).data,
  getPlan: async (id: string) => (await apiClient.get<FinancialPlan>(`/api/plans/${id}`)).data,
  
  createPlan: async (company_id: string, plan_name: string, start_month: string, currency_code: string) => {
    return (await apiClient.post<FinancialPlan>('/api/plans', { 
      company_id, 
      plan_name, 
      start_month, 
      currency_code,
      tenant_id: getTenantId()
    })).data;
  },
  
  updatePlan: async (id: string, updates: UpdatePlanRequest) => 
    (await apiClient.put<FinancialPlan>(`/api/plans/${id}`, updates)).data,
  
  deletePlan: async (id: string) => {
    await apiClient.delete(`/api/plans/${id}`);
  },

  getProjection: async (planId: string, params?: { 
    mode?: string, 
    months?: number, 
    stop_insolvency?: boolean, 
    initial_cash?: number, 
    insolvency_threshold?: string,
    events_active?: boolean
  }) => 
    (await apiClient.get<SimulationResult>(`/api/plans/${planId}/projection`, { params })).data,

  // REVENUE
  getRevenueItems: async (planId: string) => (await apiClient.get<RevenueItem[]>(`/api/plans/${planId}/revenue`)).data,
  createRevenueItem: async (item: Omit<RevenueItem, 'id'>) => (await apiClient.post<RevenueItem>('/api/revenue', item)).data,
  updateRevenueItem: async (id: string, item: Partial<RevenueItem>) => (await apiClient.put<RevenueItem>(`/api/revenue/${id}`, item)).data,
  deleteRevenueItem: async (id: string) => (await apiClient.delete(`/api/revenue/${id}`)),

  // EXPENSES
  getExpenseItems: async (planId: string) => 
    (await apiClient.get<ExpenseItem[]>(`/api/plans/${planId}/expenses`)).data,
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

  // LIFECYCLE
  duplicateFund: async (id: string) => (await apiClient.post<Fund>(`/api/lifecycle/funds/${id}/duplicate`, {}, { timeout: 60000 })).data,
  duplicateCompany: async (id: string) => (await apiClient.post<Company>(`/api/lifecycle/companies/${id}/duplicate`, {}, { timeout: 60000 })).data,
  duplicatePlan: async (id: string) => (await apiClient.post<FinancialPlan>(`/api/lifecycle/plans/${id}/duplicate`, {}, { timeout: 60000 })).data,
  moveCompany: async (id: string, target_fund_id: string) => 
    (await apiClient.put<Company>(`/api/lifecycle/companies/${id}/move`, { target_fund_id }, { timeout: 60000 })).data,

  // TEMPLATES
  getTemplates: async () => (await apiClient.get<Template[]>('/api/lifecycle/templates', { timeout: 60000 })).data,
  importTemplate: async (id: string) => (await apiClient.post<Fund>(`/api/lifecycle/templates/${id}/clone`, {}, { timeout: 60000 })).data,

  // SWAN EVENTS (Formerly Shocks)
  getEvents: async (targetIds: string[]) => {
    const params = new URLSearchParams();
    if (targetIds.length) {
      params.append('target_ids', targetIds.join(','));
    }
    // Use any[] to allow mapping from alternative backend field names
    const response = await apiClient.get<any[]>('/api/events', { params });
    
    return response.data.map((item) => {
      // Normalization Logic
      let scope = item.scope;
      if (!scope) {
        if (item.fund_ids && item.fund_ids.length > 0) scope = 'global';
        else if (item.company_ids && item.company_ids.length > 0) scope = 'local';
        else scope = 'global'; // Default fallback
      }

      // Ensure target_ids is populated
      const target_ids = item.target_ids || [...(item.fund_ids || []), ...(item.company_ids || [])];

      return {
        ...item,
        scope,
        target_ids,
        // Map backend fields to frontend fields
        occurrence_probability: item.occurrence_probability || item.likelihood_annual_pct || '0',
        event_type: item.event_type || item.event_category || 'revenue_hit',
        magnitude: item.magnitude,
        direction: item.direction,
        duration: item.duration || item.duration_category,
        is_counter_cyclic: item.is_counter_cyclic
      };
    }) as SwanEvent[];
  },
  
  createEvent: async (event: Omit<SwanEvent, 'id'>) => (await apiClient.post<SwanEvent>('/api/events', event)).data,
  
  updateEvent: async (id: string, event: Partial<SwanEvent>) => (await apiClient.put<SwanEvent>(`/api/events/${id}`, event)).data,
  
  deleteEvent: async (id: string) => (await apiClient.delete(`/api/events/${id}`)),
};
