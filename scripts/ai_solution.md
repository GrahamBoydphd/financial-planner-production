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

<file path='frontend/context/AuthContext.tsx'>
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export interface User {
  username: string;
  full_name: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  full_name: string;
  company_name: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  user: User | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Initialize token and user from localStorage on mount
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken) {
      setToken(storedToken);
    }
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Failed to parse user from localStorage", error);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (payload: LoginPayload) => {
    try {
      const response = await api.login(payload.username, payload.password);
      const newToken = response.token;
      
      // Use full_name from response if available, otherwise fallback to username
      // Casting to any to avoid TS errors if api types aren't updated yet
      const fullName = (response as any).full_name || payload.username;
      const userObj: User = { username: payload.username, full_name: fullName };

      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userObj));
      
      setToken(newToken);
      setUser(userObj);
      
      router.push('/'); // Redirect to dashboard
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  };

  const register = async (payload: RegisterPayload) => {
    try {
      const response = await api.register(payload.username, payload.email, payload.password, payload.full_name, payload.company_name);
      const newToken = response.token;
      
      // Use full_name from response if available, otherwise fallback to username
      const fullName = (response as any).full_name || payload.username;
      const userObj: User = { username: payload.username, full_name: fullName };

      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userObj));
      
      setToken(newToken);
      setUser(userObj);
      
      router.push('/'); // Redirect to dashboard
    } catch (error) {
      console.error("Registration failed", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated: !!token, 
      token, 
      user,
      login, 
      register, 
      logout, 
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
</file>

<file path='frontend/components/forms/AuthForm.tsx'>
"use client";

import React, { useState } from 'react';
import Link from 'next/link';

interface AuthFormProps {
  mode: 'login' | 'register';
  onSubmit: (data: any) => Promise<void>;
}

export default function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isStudent, setIsStudent] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStudentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsStudent(checked);
    if (checked) {
      setCompanyName('Individual');
    } else {
      setCompanyName('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError('Username and password are required.');
      return;
    }

    if (mode === 'register') {
      if (!fullName) {
        setError('Full Name is required.');
        return;
      }
      if (!email) {
        setError('Email is required.');
        return;
      }
      if (!companyName) {
        setError('Company / Organization Name is required.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await onSubmit({ username, email, password, full_name: fullName, company_name: companyName });
      } else {
        await onSubmit({ username, password });
      }
    } catch (err: any) {
      console.error(err);
      
      // Debugging 422: Show raw JSON
      setError(JSON.stringify(err.response?.data) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h2>
        
        {error && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-500 border border-red-200 break-words whitespace-pre-wrap">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter your username"
              required
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="fullName">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter your full name"
                required
              />
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter your email"
                required
              />
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="companyName">
                Company / Organization Name
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isStudent}
                className={`w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${isStudent ? 'bg-gray-100 text-gray-500' : ''}`}
                placeholder={isStudent ? "Individual" : "Enter company name"}
                required={!isStudent}
              />
              <div className="mt-2 flex items-center">
                <input
                  id="isStudent"
                  type="checkbox"
                  checked={isStudent}
                  onChange={handleStudentChange}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isStudent" className="ml-2 block text-sm text-gray-900">
                  I am a student / individual
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter your password"
              required
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Confirm your password"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <Link href="/register" className="font-medium text-blue-600 hover:underline">
                Register
              </Link>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-blue-600 hover:underline">
                Login
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
</file>

