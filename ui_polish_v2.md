🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
Here are the updated files implementing the UI/UX polish, valuation fixes, and staffing form updates.

### 1. `frontend/components/forms/StaffingForm.tsx`
*   **Updates:**
    *   `handleAddNew`: Initializes `annual_increase` to `3.0` (3%).
    *   `handleEdit`: Multiplies existing `annual_increase` by 100 (0.03 -> 3.0).
    *   `handleSubmit`: Divides input value by 100 (3.5 -> 0.035).
    *   **Input**: Added `step="0.1"` and updated tooltip.

```tsx
"use client"

import React, { useState, useEffect } from "react"
import { Plus, Trash2, Edit2, Save, X, Users, DollarSign, Calendar, TrendingUp, Briefcase } from "lucide-react"
import { StaffingRole } from "@/lib/api"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Tooltip from "@/components/ui/Tooltip"

interface StaffingFormProps {
  planId: string
  initialRoles: StaffingRole[]
  onSave: (role: Omit<StaffingRole, "id" | "plan_id"> & { id?: string }) => Promise<void>
  onDelete: (roleId: string) => Promise<void>
}

// Helper to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function StaffingForm({ planId, initialRoles, onSave, onDelete }: StaffingFormProps) {
  const [roles, setRoles] = useState<StaffingRole[]>(initialRoles)
  const [isEditing, setIsEditing] = useState(false)
  const [currentRole, setCurrentRole] = useState<Partial<StaffingRole>>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Update local state when initialRoles changes
  useEffect(() => {
    setRoles(initialRoles)
  }, [initialRoles])

  const handleAddNew = () => {
    setCurrentRole({
      role_name: "",
      annual_salary: 50000,
      start_month: 1,
      target_count: 1,
      hiring_plan: "fixed_count",
      hiring_rate: 1,
      annual_increase: 3.0 // Default to 3.0% for the input
    })
    setIsEditing(true)
    setError(null)
  }

  const handleEdit = (role: StaffingRole) => {
    setCurrentRole({ 
      ...role,
      // Convert decimal (0.03) to percentage (3.0) for editing
      annual_increase: (role.annual_increase || 0) * 100 
    })
    setIsEditing(true)
    setError(null)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this role?")) {
      try {
        setIsLoading(true)
        await onDelete(id)
        setRoles(roles.filter(r => r.id !== id))
      } catch (err) {
        console.error("Failed to delete role:", err)
        setError("Failed to delete role. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setCurrentRole({})
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentRole.role_name) {
      setError("Role Name is required")
      return
    }

    try {
      setIsLoading(true)
      const roleData = {
        role_name: currentRole.role_name,
        annual_salary: Number(currentRole.annual_salary) || 0,
        start_month: Number(currentRole.start_month) || 1,
        target_count: Number(currentRole.target_count) || 1,
        hiring_plan: currentRole.hiring_plan || "fixed_count",
        hiring_rate: currentRole.hiring_plan === "monthly_rate" ? (Number(currentRole.hiring_rate) || 1) : undefined,
        // Convert percentage (3.5) back to decimal (0.035) for saving
        annual_increase: (Number(currentRole.annual_increase) || 0) / 100
      }

      await onSave({
        ...roleData,
        id: currentRole.id 
      })

      setIsEditing(false)
      setCurrentRole({})
    } catch (err) {
      console.error("Failed to save role:", err)
      setError("Failed to save role. Please check your inputs.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staffing & Payroll
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Manage headcount, salaries, and hiring timelines.
            </p>
          </div>
          {!isEditing && (
            <Button onClick={handleAddNew} className="gap-1 flex items-center text-sm">
              <Plus className="h-4 w-4" /> Add Role
            </Button>
          )}
        </div>
      
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded mb-4 border border-red-200">
            <h4 className="font-bold text-sm">Error</h4>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4 border p-4 rounded-md bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="role_name" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Role Name <span className="text-red-500">*</span>
                  <Tooltip content="Title of the position (e.g., 'Sales Rep', 'Developer')." />
                </label>
                <input
                  id="role_name"
                  value={currentRole.role_name || ""}
                  onChange={(e) => setCurrentRole({ ...currentRole, role_name: e.target.value })}
                  placeholder="e.g. Sales Representative"
                  className="w-full rounded border-gray-300 border p-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="annual_salary" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Annual Salary
                  <Tooltip content="Base annual salary per person in this role." />
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="annual_salary"
                    type="number"
                    min="0"
                    className="w-full rounded border-gray-300 border p-2 pl-8 text-sm"
                    value={currentRole.annual_salary || ""}
                    onChange={(e) => setCurrentRole({ ...currentRole, annual_salary: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="hiring_plan" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Hiring Plan
                  <Tooltip content="How employees are added over time." />
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <select
                    id="hiring_plan"
                    className="w-full rounded border-gray-300 border p-2 pl-8 text-sm bg-white"
                    value={currentRole.hiring_plan || "fixed_count"}
                    onChange={(e) => setCurrentRole({ ...currentRole, hiring_plan: e.target.value as any })}
                  >
                    <option value="fixed_count">Fixed Count (All at once)</option>
                    <option value="monthly_rate">Ramp Up (Over time)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="target_count" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Target Headcount
                  <Tooltip content="Maximum number of people to hire for this role." />
                </label>
                <div className="relative">
                  <Users className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="target_count"
                    type="number"
                    min="1"
                    step="1"
                    className="w-full rounded border-gray-300 border p-2 pl-8 text-sm"
                    value={currentRole.target_count || ""}
                    onChange={(e) => setCurrentRole({ ...currentRole, target_count: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              {currentRole.hiring_plan === "monthly_rate" && (
                <div className="space-y-2">
                  <label htmlFor="hiring_rate" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                    Hiring Pace (Months per Hire)
                    <Tooltip content="Hire 1 person every X months. (e.g., 1 = monthly, 3 = quarterly)." />
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      id="hiring_rate"
                      type="number"
                      min="1"
                      step="1"
                      className="w-full rounded border-gray-300 border p-2 pl-8 text-sm"
                      value={currentRole.hiring_rate || ""}
                      onChange={(e) => setCurrentRole({ ...currentRole, hiring_rate: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="start_month" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Start Month
                  <Tooltip content="Month number (1-60) when hiring begins." />
                </label>
                <div className="relative">
                  <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="start_month"
                    type="number"
                    min="1"
                    max="60"
                    className="w-full rounded border-gray-300 border p-2 pl-8 text-sm"
                    value={currentRole.start_month || ""}
                    onChange={(e) => setCurrentRole({ ...currentRole, start_month: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="annual_increase" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Annual Increase (%)
                  <Tooltip content="Expected annual salary increase (e.g., 3.5 for 3.5%)." />
                </label>
                <div className="relative">
                  <TrendingUp className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="annual_increase"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="w-full rounded border-gray-300 border p-2 pl-8 text-sm"
                    value={currentRole.annual_increase || ""}
                    onChange={(e) => setCurrentRole({ ...currentRole, annual_increase: parseFloat(e.target.value) })}
                  />
                </div>
                <p className="text-xs text-gray-500 text-right">
                  Enters as: {currentRole.annual_increase}%
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={handleCancel} disabled={isLoading} className="flex items-center">
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="flex items-center">
                <Save className="h-4 w-4 mr-1" /> {currentRole.id ? "Update Role" : "Add Role"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Role Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Salary (Annual)</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Plan</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Target</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Start</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {roles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      No staffing roles defined yet. Click "Add Role" to begin.
                    </td>
                  </tr>
                ) : (
                  roles.map((role) => (
                    <tr key={role.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{role.role_name}</td>
                      <td className="px-4 py-3">{formatCurrency(role.annual_salary)}</td>
                      <td className="px-4 py-3">
                        {role.hiring_plan === "monthly_rate" 
                          ? `Ramp (1/${role.hiring_rate || 1}mo)` 
                          : "Fixed"}
                      </td>
                      <td className="px-4 py-3">{role.target_count}</td>
                      <td className="px-4 py-3">Month {role.start_month}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(role)}
                            className="p-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(role.id)}
                            className="p-1 text-red-600 hover:text-red-800 rounded hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
    </Card>
  )
}
```

### 2. `frontend/app/plan/[planId]/results/page.tsx`
*   **Updates:**
    *   `isLogScale` defaults to `true`.
    *   `currency` defaults to `''` (None).
    *   Table columns reordered: Month, Rev, GP, OpEx, Net, Cash, Divs, Net Val.
    *   Runway Label: "Runway (Median, P50)" in Monte Carlo mode.
    *   `handleSaveValuation`: Added `date_applied` to payload.

```tsx
'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import CashFlowChart from '@/components/CashFlowChart';
import Button from '@/components/ui/Button';
import { api, FinancialPlan, CapitalInjection, DividendPolicy, CreditFacility } from '@/lib/api';

// --- COMPONENT: KPI CARDS ---
interface KPIProps {
  simMode: string;
  projection: any;
  creditLimit: string;
  stopInsolvency: boolean;
  currency: string;
}

const KPICards = ({ simMode, projection, creditLimit, stopInsolvency, currency }: KPIProps) => {
    if (!projection) return null;

    // Helper to format with currency
    const fmt = (n: any) => 
        `${currency}${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    const lastData = projection.deterministic_data?.[projection.deterministic_data.length - 1] || {};
    const singleLastData = projection.single_run_data?.[projection.single_run_data.length - 1] || lastData;

    let totalVal = lastData.total_value;
    let valuation = projection.deterministic_valuation;
    let subtitle = 'Deterministic Average';
    let insolvencyMonth = -1;
    let runwayVal: number | string = 'Infinite';

    const checkInsolvency = (dataArray: any[]) => {
        if (!dataArray) return -1;
        const idx = dataArray.findIndex(m => m.is_insolvent || Number(m.cash_balance) < -(Number(creditLimit) || 0));
        return idx !== -1 ? dataArray[idx].month_index : -1;
    };

    // RUNWAY CALCULATION HELPER
    const calculateRunway = (cash: number, netIncome: number) => {
        if (netIncome >= 0) return 'Infinite';
        const burn = -netIncome;
        const available = cash + Number(creditLimit);
        if (available <= 0) return 0;
        return Math.floor(available / burn);
    };

    if (simMode === 'single') {
        totalVal = singleLastData.total_value;
        valuation = projection.single_run_valuation;
        subtitle = 'Single Run Result';
        if (projection.single_run_data) {
            insolvencyMonth = checkInsolvency(projection.single_run_data);
            runwayVal = calculateRunway(Number(singleLastData.cash_balance), Number(singleLastData.net_income));
        }
    } else if (simMode === 'monte_carlo') {
        totalVal = projection.p50_value?.[projection.p50_value.length - 1] || 0;
        valuation = projection.p50_valuation;
        subtitle = 'Median (P50)';
        runwayVal = projection.p50_runway ?? 'Infinite';
        
    } else {
        // Standard
        insolvencyMonth = checkInsolvency(projection.deterministic_data);
        runwayVal = calculateRunway(Number(lastData.cash_balance), Number(lastData.net_income));
    }

    const p90Val = projection.p90_value?.[projection.p90_value.length - 1] || 0;

    return (
      <>
        <Card className="text-center border-b-4 border-gray-500 mb-4">
          <h3 className="text-gray-500 text-xs uppercase font-bold">Net Value (Cash+Divs)</h3>
          <p className={`text-2xl font-bold ${totalVal < 0 ? 'text-red-600' : 'text-gray-700'}`}>
            {fmt(totalVal)}
          </p>
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        </Card>

        {simMode === 'monte_carlo' && (
          <Card className="text-center border-b-4 border-blue-600 mb-4">
            <h3 className="text-blue-700 text-xs uppercase font-bold">Upside (P90)</h3>
            <p className={`text-2xl font-bold ${p90Val < 0 ? 'text-red-600' : 'text-blue-700'}`}>
              {fmt(p90Val)}
            </p>
          </Card>
        )}

        <Card className="text-center mb-4">
            <h3 className="text-gray-500 text-sm uppercase">Valuation (Est)</h3>
            <p className="text-2xl font-bold text-green-600">{fmt(valuation)}</p>
            <p className="text-xs text-gray-400 mt-1">Based on Final Revenue</p>
        </Card>
        
        <Card className="text-center mb-4">
            <h3 className="text-gray-500 text-sm uppercase">
                {simMode === 'monte_carlo' ? 'Runway (Median, P50)' : 'Runway'}
            </h3>
            {insolvencyMonth !== -1 ? (
                <div className="text-red-600">
                    <p className="text-xl font-bold">Insolvent in Month {insolvencyMonth}</p>
                    <p className="text-xs mt-1">
                        {stopInsolvency ? 'Trading Stopped' : 'Showing fantasy projection'}
                    </p>
                </div>
            ) : runwayVal === 0 ? (
                <p className="text-2xl font-bold text-red-600">Insolvent (0 Mo)</p>
            ) : runwayVal !== 'Infinite' ? (
                <p className="text-2xl font-bold text-purple-600">{runwayVal} Mo</p>
            ) : (
                <p className="text-2xl font-bold text-purple-600">Infinite</p>
            )}
        </Card>
      </>
    );
};

// --- MAIN PAGE COMPONENT ---
export default function ResultsPage({ params }: { params: { planId: string } }) {
  const { planId } = params;
  const [plan, setPlan] = useState<FinancialPlan | null>(null);
  const [projection, setProjection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
   
  // Financial State
  const [capitalItems, setCapitalItems] = useState<CapitalInjection[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dividendPolicy, setDividendPolicy] = useState<DividendPolicy | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [creditFacility, setCreditFacility] = useState<CreditFacility | null>(null);
   
  // Forms State
  const [newCapName, setNewCapName] = useState('');
  const [newCapAmount, setNewCapAmount] = useState('');
  const [newCapMonth, setNewCapMonth] = useState('');

  const [divEnabled, setDivEnabled] = useState(false);
  const [divThreshold, setDivThreshold] = useState('50000');
  const [divRatio, setDivRatio] = useState('20');

  const [creditLimit, setCreditLimit] = useState('0');
  const [creditRate, setCreditRate] = useState('10');
  const [creditIsAnnual, setCreditIsAnnual] = useState(true);

  const [valMultiple, setValMultiple] = useState('5'); 

  // Controls
  const [years, setYears] = useState(5);
  const [isLogScale, setIsLogScale] = useState(true); // Default Log Scale
  const [simMode, setSimMode] = useState<'single' | 'monte_carlo' | 'standard'>('standard');
  const [stopInsolvency, setStopInsolvency] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // UI Settings
  const [currency, setCurrency] = useState(''); // Default None

  // --- 1. DATA LOADING ---
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const p = await api.getPlan(planId);
        setPlan(p);
        
        const caps = await api.getCapitalInjections(planId);
        setCapitalItems(caps);
        
        try {
          const div = await api.getDividends(planId);
          setDividendPolicy(div);
          setDivEnabled(div.is_enabled);
          setDivThreshold(div.safety_threshold.toString());
          setDivRatio(div.payout_ratio.toString());
        } catch { /* No policy set */ }

        try {
          const cred = await api.getCredit(planId);
          setCreditFacility(cred);
          setCreditLimit(cred.facility_limit.toString());
          setCreditRate(cred.interest_rate.toString());
          setCreditIsAnnual(cred.is_annual_rate);
        } catch { /* No credit set */ }

        // Use standard or monte_carlo depending on UI
        const backendMode = simMode === 'monte_carlo' ? 'monte_carlo' : 'single';
        const proj = await api.getProjection(planId, {
           mode: backendMode,
           stop_insolvency: stopInsolvency,
           initial_cash: p.initial_cash // Pass initial cash from plan
        });
        
        // --- DATA MAPPING FOR TABLE ---
        let sourceData = proj.deterministic_data;
        if (backendMode === 'single' && proj.single_run_data) {
           sourceData = proj.single_run_data;
        }

        const tableData = sourceData.map((m: any) => ({
           month_index: m.month_index,
           date: m.date,
           revenue: m.revenue,
           cogs: m.cogs,
           gross_profit: m.gross_profit,
           opex: m.opex,
           net_income: m.net_income,
           cash_balance: m.cash_balance,
           total_value: m.total_value, 
           dividend_paid: m.dividend_paid,
           is_insolvent: m.is_insolvent
        }));
        
        (proj as any).cash_flow_data = tableData;
        setProjection(proj);

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [planId, years, simMode, stopInsolvency, refreshTrigger]); 

  // --- 2. HANDLERS ---
  const handleAddCapital = async () => {
    if (!newCapName || !newCapAmount) return;
    await api.createCapitalInjection({
      plan_id: planId,
      name: newCapName,
      amount: Number(newCapAmount),
      month: Number(newCapMonth || 0)
    });
    setNewCapName(''); setNewCapAmount(''); setNewCapMonth('');
    setRefreshTrigger(n => n + 1);
  };

  const handleDeleteCapital = async (id: string) => {
    await api.deleteCapitalInjection(id);
    setRefreshTrigger(n => n + 1);
  };

  const handleSaveDividends = async () => {
    await api.upsertDividends({
      plan_id: planId,
      is_enabled: divEnabled,
      safety_threshold: Number(divThreshold),
      payout_ratio: Number(divRatio)
    });
    setRefreshTrigger(n => n + 1);
  };

  const handleSaveCredit = async () => {
    await api.upsertCredit({
      plan_id: planId,
      facility_limit: Number(creditLimit),
      interest_rate: Number(creditRate),
      is_annual_rate: creditIsAnnual
    });
    setRefreshTrigger(n => n + 1);
  };

  const handleSaveValuation = async () => {
    await api.createValuation({
      plan_id: planId,
      revenue_multiple: Number(valMultiple),
      date_applied: new Date().toISOString() // Fix 422
    });
    setRefreshTrigger(n => n + 1);
  };

  // Helper
  const fmt = (n: any) => 
    `${currency}${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  if (!plan) return <Layout>Loading...</Layout>;

  return (
    <Layout>
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">{plan.name} - Projections</h1>
          <p className="text-gray-500">Financial Simulation Engine v2.0</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
            <div className="bg-white p-2 rounded shadow flex items-center gap-4">
              <select 
                className="border rounded p-1 text-sm bg-white"
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
              >
                {[1, 2, 3, 5, 10, 20, 50, 100].map(y => <option key={y} value={y}>{y} Years</option>)}
              </select>

              <div className="flex items-center gap-2 border-l pl-4">
                <input 
                  type="checkbox" id="logScale" 
                  checked={isLogScale} onChange={(e) => setIsLogScale(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <label htmlFor="logScale" className="text-sm font-medium cursor-pointer">Log Scale</label>
              </div>

              <div className="flex items-center gap-2 border-l pl-4">
                <select 
                  className="border rounded p-1 text-sm font-bold text-blue-800 bg-blue-50"
                  value={simMode}
                  onChange={(e) => setSimMode(e.target.value as any)}
                >
                  <option value="standard">Standard (Average)</option>
                  <option value="single">Single Path (Volatile)</option>
                  <option value="monte_carlo">Monte Carlo (1000 Runs)</option>
                </select>
              </div>

              {/* Currency Selector */}
              <div className="flex items-center gap-2 border-l pl-4">
                  <span className="text-xs text-gray-500">Currency:</span>
                  <select 
                    className="border rounded p-1 text-sm font-bold"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                      <option value="">None</option>
                      <option value="$">$</option>
                      <option value="€">€</option>
                      <option value="£">£</option>
                      <option value="¥">¥</option>
                  </select>
              </div>

              {/* Insolvency Checkbox */}
              <div className="flex items-center gap-2 border-l pl-4">
                <input 
                  type="checkbox" id="stopInsolvency" 
                  checked={stopInsolvency} onChange={(e) => setStopInsolvency(e.target.checked)}
                  className="rounded text-red-600"
                />
                <label htmlFor="stopInsolvency" className="text-sm font-medium cursor-pointer text-red-800">Stop on Insolvency</label>
              </div>
            </div>

            <div className="flex gap-2">
              {simMode === 'single' && (
                 <Button variant="secondary" onClick={() => setRefreshTrigger(n => n + 1)}>Recalculate 🎲</Button>
              )}
              <a href={`/plan/${planId}/inputs`} className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 font-medium">Edit Revenue/Cost</a>
            </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 animate-pulse text-blue-600 font-medium">Running Simulation...</div>
      ) : projection && (
        <div className="space-y-8">
          
          {simMode === 'single' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-700">Deterministic (Average)</h2>
                </div>
                <div className="h-80">
                  <CashFlowChart 
                    data={projection} 
                    isLog={isLogScale} 
                    mode="standard" 
                    creditLimit={Number(creditLimit)}
                    currencySymbol={currency}
                  />
                </div>
              </Card>
              <Card>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-blue-700">Volatile (Single Run)</h2>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Stochastic</span>
                </div>
                <div className="h-80">
                  <CashFlowChart 
                    data={projection} 
                    isLog={isLogScale} 
                    mode="single" 
                    creditLimit={Number(creditLimit)}
                    currencySymbol={currency}
                  />
                </div>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-grow">
                <Card className="h-full">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">Total Value Forecast</h2>
                    {simMode === 'monte_carlo' && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Fan Chart Active</span>}
                  </div>
                  <div className="h-96">
                    <CashFlowChart 
                      data={projection} 
                      isLog={isLogScale} 
                      mode={simMode} 
                      creditLimit={Number(creditLimit)}
                      currencySymbol={currency}
                    />
                  </div>
                </Card>
              </div>
              <div className="w-full lg:w-64 flex-shrink-0">
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                   <KPICards simMode={simMode} projection={projection} creditLimit={creditLimit} stopInsolvency={stopInsolvency} currency={currency} />
                </div>
              </div>
            </div>
          )}

          {simMode === 'single' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <KPICards simMode={simMode} projection={projection} creditLimit={creditLimit} stopInsolvency={stopInsolvency} currency={currency} />
            </div>
          )}

          {/* --- INLINED GRID TO FIX FOCUS LOSS --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <Card>
              <h3 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">Valuation Model</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block">Revenue Multiple (x)</label>
                  <input type="number" step="0.1" className="border p-1 w-full text-sm rounded" 
                    value={valMultiple} onChange={e => setValMultiple(e.target.value)} 
                    placeholder="e.g. 5.0"
                  />
                </div>
                <div className="text-xs text-gray-400 italic">
                  Valuation = Annual Revenue × Multiple
                </div>
                <button onClick={handleSaveValuation} className="w-full bg-blue-600 text-white text-sm py-1 rounded">Set Valuation</button>
              </div>
            </Card>

            <Card>
              <h3 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">Capital Stack</h3>
              <div className="space-y-2 mb-4 h-24 overflow-y-auto">
                {capitalItems.length === 0 && <p className="text-sm text-gray-400 italic">No external capital.</p>}
                {capitalItems.map(c => (
                  <div key={c.id} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                    <div>
                      <span className="font-bold block">{c.name}</span>
                      <span className="text-xs text-gray-500">Month {c.month}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-green-700">{fmt(c.amount)}</span>
                      <button onClick={() => handleDeleteCapital(c.id)} className="text-red-400 hover:text-red-600">×</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Name" className="border p-1 text-xs rounded col-span-2" 
                  value={newCapName} onChange={e => setNewCapName(e.target.value)} />
                <input type="number" placeholder="$" className="border p-1 text-xs rounded" 
                  value={newCapAmount} onChange={e => setNewCapAmount(e.target.value)} />
                <input type="number" placeholder="Mo" className="border p-1 text-xs rounded" 
                  value={newCapMonth} onChange={e => setNewCapMonth(e.target.value)} />
                <button onClick={handleAddCapital} className="bg-gray-700 text-white text-xs py-1 rounded col-span-2">Add</button>
              </div>
            </Card>

            <Card>
              <h3 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">Dividend Policy</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Enable?</label>
                  <input type="checkbox" checked={divEnabled} onChange={e => setDivEnabled(e.target.checked)} className="h-4 w-4" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block">Safety Threshold ($)</label>
                  <input type="number" className="border p-1 w-full text-sm rounded" 
                    value={divThreshold} onChange={e => setDivThreshold(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block">Payout Ratio (%)</label>
                  <input type="number" className="border p-1 w-full text-sm rounded" 
                    value={divRatio} onChange={e => setDivRatio(e.target.value)} />
                </div>
                <button onClick={handleSaveDividends} className="w-full bg-green-600 text-white text-sm py-1 rounded">Update</button>
              </div>
            </Card>

            <Card>
              <h3 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">Credit / Overdraft</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block">Limit ($)</label>
                  <input type="number" className="border p-1 w-full text-sm rounded" 
                    value={creditLimit} onChange={e => setCreditLimit(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block">Rate (%)</label>
                  <input type="number" className="border p-1 w-full text-sm rounded" 
                    value={creditRate} onChange={e => setCreditRate(e.target.value)} />
                </div>
                <div className="flex gap-2 text-xs">
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={creditIsAnnual} onChange={() => setCreditIsAnnual(true)} /> Annual
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={!creditIsAnnual} onChange={() => setCreditIsAnnual(false)} /> Monthly
                  </label>
                </div>
                <button onClick={handleSaveCredit} className="w-full bg-purple-600 text-white text-sm py-1 rounded">Set</button>
              </div>
            </Card>
          </div>

          <Card className="overflow-x-auto max-h-96">
            <table className="min-w-full text-xs text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Revenue</th>
                  <th className="px-4 py-3">Gross Profit</th>
                  <th className="px-4 py-3">OpEx</th>
                  <th className="px-4 py-3">Net Income</th>
                  <th className="px-4 py-3 text-gray-900 font-bold">Cash Bal</th>
                  <th className="px-4 py-3 text-green-600">Dividends</th>
                  <th className="px-4 py-3 text-blue-700 font-bold">Net Value</th>
                </tr>
              </thead>
              <tbody>
                {(projection as any).cash_flow_data.map((row: any) => (
                  <tr key={row.month_index} className={`border-b hover:bg-gray-50 ${row.is_insolvent ? 'bg-red-50' : 'bg-white'}`}>
                    <td className="px-4 py-2 font-medium">{row.month_index}</td>
                    <td className="px-4 py-2">{fmt(row.revenue)}</td>
                    <td className="px-4 py-2">{fmt(row.gross_profit)}</td>
                    <td className="px-4 py-2">{fmt(row.opex)}</td>
                    <td className={`px-4 py-2 ${row.net_income < 0 ? 'text-red-500' : 'text-green-600'}`}>{fmt(row.net_income)}</td>
                    <td className={`px-4 py-2 font-bold ${row.cash_balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>{fmt(row.cash_balance)}</td>
                    <td className="px-4 py-2 text-green-600">{row.dividend_paid > 0 ? fmt(row.dividend_paid) : '-'}</td>
                    <td className={`px-4 py-2 font-bold ${row.total_value < 0 ? 'text-red-600' : 'text-blue-700'}`}>
                      {fmt(row.total_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </Layout>
  );
}
```

### 3. `frontend/components/CashFlowChart.tsx`
*   **Updates:**
    *   Added logic to append " - Log Scale" to the Y-axis title when log scale is active.

```tsx
'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { SimulationResult, MonthlyData } from '@/lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// --- Helper: Generate Diagonal Hatch Pattern ---
function createDiagonalPattern(color: string) {
  if (typeof document === 'undefined') return color;

  const shape = document.createElement('canvas');
  shape.width = 10;
  shape.height = 10;
  const c = shape.getContext('2d');
  if (!c) return color;

  c.strokeStyle = color;
  c.lineWidth = 2; 
  c.beginPath();
  c.moveTo(0, 10);
  c.lineTo(10, 0);
  c.stroke();
  
  return c.createPattern(shape, 'repeat') || color;
}

interface Props {
  data: SimulationResult;
  isLog?: boolean;
  mode: 'single' | 'monte_carlo' | 'standard';
  creditLimit?: number;
  currencySymbol?: string; 
}

export default function CashFlowChart({ data, isLog = false, mode, creditLimit = 0, currencySymbol = '$' }: Props) {
  const labels = data.labels;
  const datasets = [];

  // --- 0. DETERMINE SOURCE DATA ---
  let sourceData: MonthlyData[] = data.deterministic_data;
  if (mode === 'single' && data.single_run_data) {
    sourceData = data.single_run_data;
  }

  // --- 1. The "Red Line" (Cumulative Investment) ---
  // Clamp negative values in Log mode to avoid breaks
  const investmentData = data.deterministic_data.map(d => {
      const val = Number(d.cumulative_external_capital);
      return (isLog && val <= 100) ? 100 : val;
  });

  datasets.push({
    label: 'Cumulative Investment',
    data: investmentData,
    borderColor: 'rgb(220, 38, 38)', // Red-600
    borderWidth: 2,
    pointRadius: 0,
    tension: 0,
    pointStyle: 'line', 
    fill: false,
    order: 1, 
  });

  // --- 2. Deterministic / Single Run Mode ---
  if (mode === 'standard' || mode === 'single') {
    
    // A. Net Value (Blue Solid)
    const valueData = sourceData.map(d => {
        const val = Number(d.total_value);
        return (isLog && val <= 100) ? 100 : val;
    });
    datasets.push({
      label: 'Net Value (Cash+Divs)',
      data: valueData,
      borderColor: 'rgb(37, 99, 235)', // Blue-600
      borderWidth: 3,
      pointRadius: 0,
      tension: 0.1,
      pointStyle: 'line', 
      fill: false,
      order: 2,
    });

    // B. Cash on Hand (Teal Solid)
    const cashData = sourceData.map(d => {
        const val = Number(d.cash_balance);
        return (isLog && val <= 100) ? 100 : val;
    });
    datasets.push({
      label: 'Cash on Hand',
      data: cashData,
      borderColor: 'rgb(20, 184, 166)', // Teal-500
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      pointStyle: 'line', 
      fill: false,
      order: 3,
    });

    // C. Cumulative Dividends (Gold Solid)
    const divData = sourceData.map(d => {
        const val = Number(d.cumulative_dividends);
        return (isLog && val <= 100) ? 100 : val;
    });
    datasets.push({
      label: 'Cum. Dividends',
      data: divData,
      borderColor: 'rgb(234, 179, 8)', // Yellow-500
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      pointStyle: 'line', 
      fill: false,
      order: 4,
    });

    // D. Monthly Revenue (Green Dashed)
    const revData = sourceData.map(d => {
        const val = Number(d.revenue);
        return (isLog && val <= 100) ? 100 : val;
    });
    datasets.push({
      label: 'Monthly Revenue',
      data: revData,
      borderColor: 'rgb(34, 197, 94)', // Green-500
      borderDash: [5, 5],
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      pointStyle: 'line', 
      fill: false,
      order: 5,
    });

    // E. Monthly Costs (Red Dashed)
    const costData = sourceData.map(d => {
        const val = Number(d.cogs) + Number(d.opex) + Number(d.interest_expense);
        return (isLog && val <= 100) ? 100 : val;
    });
    datasets.push({
      label: 'Monthly Costs',
      data: costData,
      borderColor: 'rgb(239, 68, 68)', // Red-500
      borderDash: [2, 2],
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      pointStyle: 'line', 
      fill: false,
      order: 6,
    });

    // F. DEBT VISUALIZATION (Stacked Area Logic)
    const rawDebtData = sourceData.map(d => {
        const cash = Number(d.cash_balance);
        return cash < 0 ? Math.abs(cash) : 0;
    });

    // 1. Covered Overdraft (Solid Purple)
    const debtCovered = rawDebtData.map(debt => Math.min(debt, creditLimit));

    datasets.push({
      label: 'Covered Overdraft',
      data: debtCovered.map(v => (isLog && v <= 100) ? 100 : v),
      borderColor: 'transparent',
      backgroundColor: 'rgba(147, 51, 234, 0.3)', // Solid Purple
      borderWidth: 0,
      pointRadius: 0,
      tension: 0,
      pointStyle: 'rect', 
      fill: 'origin', 
      order: 30, 
    });

    // 2. Fantasy Debt (Hatched Purple)
    const debtFantasy = rawDebtData.map(debt => debt); 

    datasets.push({
      label: 'Fantasy Debt (Excess)',
      data: debtFantasy.map(v => (isLog && v <= 100) ? 100 : v),
      borderColor: 'transparent', 
      backgroundColor: createDiagonalPattern('rgba(147, 51, 234, 0.6)'), 
      borderWidth: 0,
      pointRadius: 0,
      tension: 0,
      pointStyle: 'rect', 
      fill: '-1', 
      order: 31, 
    });
  }

  // --- 3. Monte Carlo Mode ---
  if (mode === 'monte_carlo' && data.p50_value) {
    
    // CALCULATE CLAMPING FLOORS
    // Linear Floor: 2x lower than P50 min
    const p50Vals = data.p50_value.map(v => Number(v));
    const minP50 = Math.min(...p50Vals);
    // If minP50 is positive, floor is 0? If negative, floor is 2 * minP50?
    const linearFloor = minP50 >= 0 ? 0 : minP50 * 2.0;
    const logFloor = 100;

    const clamp = (vals: (number | string)[] | undefined) => {
        if (!vals) return [];
        return vals.map(v => {
            const num = Number(v);
            if (isLog) {
                return num < logFloor ? logFloor : num;
            } else {
                return num < linearFloor ? linearFloor : num;
            }
        });
    };

    // LAYER 1: P100 (Max)
    datasets.push({
      label: 'Max (Top Edge)',
      data: clamp(data.p100_value),
      borderColor: 'transparent',
      pointRadius: 0,
      fill: false,
      order: 50,
    });
    // LAYER 2: P90
    datasets.push({
      label: 'Top 10% (P90-Max)',
      data: clamp(data.p90_value),
      borderColor: 'transparent',
      backgroundColor: 'rgba(30, 58, 138, 0.6)', 
      pointRadius: 0,
      pointStyle: 'rect', 
      fill: '-1', 
      order: 51,
    });
    // LAYER 3: P75
    datasets.push({
      label: 'Upper 15% (P75-P90)',
      data: clamp(data.p75_value),
      borderColor: 'transparent',
      backgroundColor: 'rgba(37, 99, 235, 0.4)', 
      pointRadius: 0,
      pointStyle: 'rect', 
      fill: '-1', 
      order: 52,
    });
    // LAYER 4: P25
    datasets.push({
      label: 'Typical 50% (P25-P75)',
      data: clamp(data.p25_value),
      borderColor: 'transparent',
      backgroundColor: 'rgba(147, 197, 253, 0.4)', 
      pointRadius: 0,
      pointStyle: 'rect', 
      fill: '-1', 
      order: 53,
    });
    // LAYER 5: P10
    datasets.push({
      label: 'Lower 15% (P10-P25)',
      data: clamp(data.p10_value),
      borderColor: 'transparent',
      backgroundColor: 'rgba(37, 99, 235, 0.4)', 
      pointRadius: 0,
      pointStyle: 'rect', 
      fill: '-1', 
      order: 54,
    });
    // LAYER 6: P0
    datasets.push({
      label: 'Bottom 10% (Min-P10)',
      data: clamp(data.p0_value),
      borderColor: 'transparent',
      backgroundColor: 'rgba(30, 58, 138, 0.6)', 
      pointRadius: 0,
      pointStyle: 'rect', 
      fill: '-1', 
      order: 55,
    });
    // LAYER 7: Median
    datasets.push({
      label: 'Median (P50)',
      data: clamp(data.p50_value),
      borderColor: 'rgb(37, 99, 235)', 
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      fill: false,
      pointStyle: 'line', 
      order: 40, 
    });
  }

  // --- SCALING LOGIC: "Snap-to-Grid" Cap ---
  let yAxisMax: number | undefined = undefined;
  if (mode === 'monte_carlo' && data.p90_value) {
    const maxP90 = Math.max(...data.p90_value.map(v => Number(v)));
    
    if (maxP90 > 0) {
      // INCREASE PADDING (Original was 2.0, adding 50% more -> 3.0)
      const rawTarget = maxP90 * 3.0;
      
      const magnitude = Math.pow(10, Math.floor(Math.log10(rawTarget)));
      const niceStep = magnitude / 2; 
      yAxisMax = Math.round(rawTarget / niceStep) * niceStep;
    }
  }

  const chartData = { labels, datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      y: {
        type: isLog ? 'logarithmic' as const : 'linear' as const,
        display: true,
        position: 'left' as const,
        title: { 
          display: true, 
          text: `Value (${currencySymbol})${isLog ? ' - Log Scale' : ''}` 
        },
        min: isLog ? 100 : undefined,
        max: yAxisMax, 
      },
    },
    plugins: {
      legend: { 
        display: true,
        labels: {
          usePointStyle: true,
          filter: function(item: any) {
            return !item.text.includes('Top Edge') && !item.text.includes('Fantasy Debt');
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label.includes('Top Edge')) return null;
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += currencySymbol + Number(context.parsed.y).toLocaleString(undefined, { maximumSignificantDigits: 3 });
            }
            return label;
          }
        }
      }
    },
  };

  return <Line options={options} data={chartData} />;
}
```

### 4. `frontend/components/forms/RevenueForm.tsx`
*   **Updates:**
    *   Renamed menu labels ("Just the averages", "Comprehensive volatility").
    *   Added `Tooltip` import and usage.
    *   Added tooltips for Simple and Comprehensive volatility.
    *   Updated NRIG dropdown labels to include "(more white/black swans)".

```tsx
'use client';

import { useState, useEffect } from 'react';
import { api, RevenueItem } from '@/lib/api';
import { ALPHA_OPTIONS, BETA_OPTIONS, SCALE_OPTIONS } from '@/lib/presets';
import Tooltip from '@/components/ui/Tooltip';

interface Props {
  planId: string;
  onSuccess: () => void;
  itemToEdit?: RevenueItem | null;
  onCancel?: () => void;
}

export default function RevenueForm({ planId, onSuccess, itemToEdit, onCancel }: Props) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('Sales');
  const [amount, setAmount] = useState('');
  const [growth, setGrowth] = useState('0');
  const [startMonth, setStartMonth] = useState('1');
  const [endMonth, setEndMonth] = useState('');
  const [freq, setFreq] = useState('Monthly');
  const [cogsPercent, setCogsPercent] = useState('');

  // Volatility
  const [volType, setVolType] = useState('none');
  const [volMin, setVolMin] = useState('');
  const [volMax, setVolMax] = useState('');
  const [volIntervals, setVolIntervals] = useState('');
  const [volMean, setVolMean] = useState('');
  const [volScale, setVolScale] = useState('');
  const [volFreedom, setVolFreedom] = useState('');
  const [volAlpha, setVolAlpha] = useState('');
  const [volBeta, setVolBeta] = useState('');

  // UI State for Simple/Advanced Mode
  const [isAdvanced, setIsAdvanced] = useState(false);

  // --- EFFECT: POPULATE FORM ON EDIT ---
  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.name);
      setSource(itemToEdit.source);
      setAmount(itemToEdit.initial_amount.toString());
      setGrowth(itemToEdit.growth_rate_percent.toString());
      setStartMonth(itemToEdit.start_month.toString());
      setEndMonth(itemToEdit.end_month ? itemToEdit.end_month.toString() : '');
      setFreq(itemToEdit.frequency);
      setCogsPercent(itemToEdit.cost_of_revenue_percent ? itemToEdit.cost_of_revenue_percent.toString() : '');
      
      const vType = itemToEdit.volatility_type || 'none';
      setVolType(vType);
      setVolMin(itemToEdit.vol_min ? itemToEdit.vol_min.toString() : '');
      setVolMax(itemToEdit.vol_max ? itemToEdit.vol_max.toString() : '');
      setVolIntervals(itemToEdit.vol_intervals ? itemToEdit.vol_intervals.toString() : '');
      setVolMean(itemToEdit.vol_mean ? itemToEdit.vol_mean.toString() : '');
      setVolScale(itemToEdit.vol_scale ? itemToEdit.vol_scale.toString() : '');
      setVolFreedom(itemToEdit.vol_freedom ? itemToEdit.vol_freedom.toString() : '');
      setVolAlpha(itemToEdit.vol_alpha ? itemToEdit.vol_alpha.toString() : '');
      setVolBeta(itemToEdit.vol_beta ? itemToEdit.vol_beta.toString() : '');

      // Default to Simple Mode
    } else {
      clearForm();
    }
  }, [itemToEdit]);

  const clearForm = () => {
    setName('');
    setSource('Sales');
    setAmount('');
    setGrowth('0');
    setStartMonth('1');
    setEndMonth('');
    setFreq('Monthly');
    setCogsPercent('');
    setVolType('none');
    setVolMin(''); setVolMax(''); setVolIntervals('');
    setVolMean(''); setVolScale(''); setVolFreedom(''); setVolAlpha(''); setVolBeta('');
    setIsAdvanced(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount) return;

    const payload = {
      plan_id: planId,
      name,
      source,
      initial_amount: Number(amount),
      growth_rate_percent: Number(growth),
      start_month: Number(startMonth),
      end_month: endMonth ? Number(endMonth) : undefined,
      frequency: freq,
      cost_of_revenue_percent: cogsPercent ? Number(cogsPercent) : undefined,
      
      volatility_type: volType !== 'none' ? volType as any : undefined,
      vol_min: volType === 'flat' && volMin ? Number(volMin) : undefined,
      vol_max: volType === 'flat' && volMax ? Number(volMax) : undefined,
      vol_intervals: volType === 'flat' && volIntervals ? Number(volIntervals) : undefined,
      vol_mean: volMean ? Number(volMean) : undefined,
      vol_scale: (volType === 'nrig' || volType === 'student_t') && volScale ? Number(volScale) : undefined,
      vol_freedom: volType === 'student_t' && volFreedom ? Number(volFreedom) : undefined,
      vol_alpha: volType === 'nrig' && volAlpha ? Number(volAlpha) : undefined,
      vol_beta: volType === 'nrig' && volBeta ? Number(volBeta) : undefined,
    };

    if (itemToEdit) {
      await api.updateRevenueItem(itemToEdit.id, payload);
    } else {
      await api.createRevenueItem(payload);
    }

    clearForm();
    onSuccess(); 
  };

  // Helper to find description
  const getAlphaDesc = () => ALPHA_OPTIONS.find(o => o.value.toString() === volAlpha)?.description;
  const getBetaDesc = () => BETA_OPTIONS.find(o => o.value.toString() === volBeta)?.description;
  const getScaleDesc = () => SCALE_OPTIONS.find(o => o.value.toString() === volScale)?.description;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-4 rounded border">
      <div className="flex justify-between items-center mb-2">
         <h3 className="font-bold text-gray-700">{itemToEdit ? 'Edit Revenue Stream' : 'Add Revenue Stream'}</h3>
         {itemToEdit && (
            <button type="button" onClick={onCancel} className="text-xs text-red-500 underline">Cancel Edit</button>
         )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500">Name</label>
          <input className="w-full border p-2 rounded text-sm" placeholder="e.g. SaaS Subs" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Source Type</label>
          <select className="w-full border p-2 rounded text-sm" value={source} onChange={e => setSource(e.target.value)}>
            <option>Sales</option>
            <option>Subscription</option>
            <option>Service</option>
            <option>Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500">Initial Amount ($)</label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Growth Rate (%/mo)</label>
          <input type="number" step="0.1" className="w-full border p-2 rounded text-sm" value={growth} onChange={e => setGrowth(e.target.value)} />
        </div>
        <div>
            <label className="text-xs text-gray-500">Cost of Rev (%)</label>
            <input type="number" className="w-full border p-2 rounded text-sm" placeholder="Optional" value={cogsPercent} onChange={e => setCogsPercent(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500">Frequency</label>
          <select className="w-full border p-2 rounded text-sm" value={freq} onChange={e => setFreq(e.target.value)}>
            <option>Monthly</option>
            <option>One-time</option>
            <option>Quarterly</option>
            <option>Annually</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Start Month</label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={startMonth} onChange={e => setStartMonth(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">End Month (Opt)</label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={endMonth} onChange={e => setEndMonth(e.target.value)} />
        </div>
      </div>

      {/* VOLATILITY SECTION */}
      <div className="border-t pt-2 mt-2">
        <div className="flex justify-between items-center mb-1">
             <label className="text-xs font-bold text-gray-700">Uncertainty / Risk Model</label>
             {volType !== 'none' && (
                 <button type="button" onClick={() => setIsAdvanced(!isAdvanced)} className="text-xs text-blue-600 underline">
                     {isAdvanced ? 'Switch to Simple Mode' : 'Switch to Advanced Mode'}
                 </button>
             )}
        </div>
        <div className="space-y-2">
            <div>
                <label className="text-xs text-gray-500">Model Type</label>
                <select className="w-full border p-1 rounded text-xs" value={volType} onChange={e => setVolType(e.target.value)}>
                    <option value="none">Just the averages</option>
                    <option value="flat">Simple volatility (min/max)</option>
                    <option value="nrig">Comprehensive volatility</option>
                    <option value="student_t">Student's t distribution</option>
                </select>
            </div>
            
            {volType !== 'none' && (
              <div className="bg-gray-100 p-2 rounded">
                 
                 {/* SIMPLE MODE DROPDOWNS (NRIG Only) */}
                 {!isAdvanced && volType === 'nrig' && (
                     <div className="space-y-3">
                         <div className="text-xs text-gray-600 italic mb-2">
                            Tier 1: Configure the shape of uncertainty.
                         </div>
                         <div>
                             <label className="text-xs text-gray-500 flex items-center gap-1">
                                Likelyhood of outliers (tail weight)
                                <Tooltip content="Controls how often extreme events (black swans) occur." />
                             </label>
                             <select className="w-full border p-1 rounded text-xs" value={volAlpha} onChange={e => setVolAlpha(e.target.value)}>
                                 <option value="">-- Select --</option>
                                 {ALPHA_OPTIONS.map(o => (
                                     <option key={o.value} value={o.value}>{o.label} (more white/black swans)</option>
                                 ))}
                             </select>
                             <p className="text-xs text-gray-400 italic mt-1">{getAlphaDesc()}</p>
                         </div>

                         <div>
                             <label className="text-xs text-gray-500 flex items-center gap-1">
                                Volatility imbalance (downside / upside)
                                <Tooltip content="Skewness: Are surprises more likely to be positive or negative?" />
                             </label>
                             <select className="w-full border p-1 rounded text-xs" value={volBeta} onChange={e => setVolBeta(e.target.value)}>
                                 <option value="">-- Select --</option>
                                 {BETA_OPTIONS.map(o => (
                                     <option key={o.value} value={o.value}>{o.label}</option>
                                 ))}
                             </select>
                             <p className="text-xs text-gray-400 italic mt-1">{getBetaDesc()}</p>
                         </div>

                         <div>
                             <label className="text-xs text-gray-500 block">Delta/Scale (Volatility)</label>
                             <select className="w-full border p-1 rounded text-xs" value={volScale} onChange={e => setVolScale(e.target.value)}>
                                 <option value="">-- Select --</option>
                                 {SCALE_OPTIONS.map(o => (
                                     <option key={o.value} value={o.value}>{o.label}</option>
                                 ))}
                             </select>
                             <p className="text-xs text-gray-400 italic mt-1">{getScaleDesc()}</p>
                         </div>
                     </div>
                 )}

                 {/* ADVANCED INPUTS OR OTHER MODELS */}
                 {(isAdvanced || volType !== 'nrig') && (
                     <div className="grid grid-cols-3 gap-2">
                         {/* Common Mean */}
                         <div className="col-span-3">
                             <label className="text-xs text-gray-400">Mean / Drift (Optional Override)</label>
                             <input placeholder="Default = Growth Rate" className="w-full border p-1 text-xs" value={volMean} onChange={e => setVolMean(e.target.value)} />
                         </div>

                         {/* Flat Params */}
                         {volType === 'flat' && (
                            <>
                                <div className="col-span-3 flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-gray-500">Range Settings</span>
                                    <Tooltip content="Define a hard minimum and maximum percentage deviation." />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Min %</label>
                                    <input className="w-full border p-1 text-xs" value={volMin} onChange={e => setVolMin(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Max %</label>
                                    <input className="w-full border p-1 text-xs" value={volMax} onChange={e => setVolMax(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Steps</label>
                                    <input className="w-full border p-1 text-xs" value={volIntervals} onChange={e => setVolIntervals(e.target.value)} />
                                </div>
                            </>
                         )}

                         {/* Student-T Params */}
                         {volType === 'student_t' && (
                            <>
                                <div>
                                    <label className="text-xs text-gray-400">Scale (Vol)</label>
                                    <input className="w-full border p-1 text-xs" value={volScale} onChange={e => setVolScale(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Freedom (Deg)</label>
                                    <input className="w-full border p-1 text-xs" value={volFreedom} onChange={e => setVolFreedom(e.target.value)} />
                                </div>
                            </>
                         )}

                         {/* NRIG Params (Advanced) */}
                         {volType === 'nrig' && (
                            <>
                                <div>
                                    <label className="text-xs text-gray-400">Likelyhood of outliers (Alpha)</label>
                                    <input className="w-full border p-1 text-xs" value={volAlpha} onChange={e => setVolAlpha(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Imbalance (Beta)</label>
                                    <input className="w-full border p-1 text-xs" value={volBeta} onChange={e => setVolBeta(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Delta (Scale)</label>
                                    <input className="w-full border p-1 text-xs" value={volScale} onChange={e => setVolScale(e.target.value)} />
                                </div>
                            </>
                         )}
                     </div>
                 )}
              </div>
            )}
        </div>
      </div>

      <button className={`w-full text-white p-2 rounded font-bold ${itemToEdit ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
        {itemToEdit ? 'Update Stream' : 'Add Stream'}
      </button>
    </form>
  );
}
```

### 5. `frontend/components/forms/ValuationForm.tsx`
*   **Updates:**
    *   Added `date_applied` to payload (Fix 422).
    *   Added toggle for Revenue vs EBITDA method.
    *   Conditionally render inputs based on selected method.

```tsx
'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  planId: string;
  onSuccess: () => void;
}

export default function ValuationForm({ planId, onSuccess }: Props) {
  const [method, setMethod] = useState<'revenue' | 'ebitda'>('revenue');
  const [revenueMultiple, setRevenueMultiple] = useState('');
  const [ebitdaMultiple, setEbitdaMultiple] = useState('');

  const handleSave = async () => {
    if (method === 'revenue' && !revenueMultiple) return;
    if (method === 'ebitda' && !ebitdaMultiple) return;

    await api.createValuation({
        plan_id: planId,
        revenue_multiple: method === 'revenue' ? Number(revenueMultiple) : undefined,
        ebitda_multiple: method === 'ebitda' ? Number(ebitdaMultiple) : undefined,
        date_applied: new Date().toISOString()
    });
    
    setRevenueMultiple('');
    setEbitdaMultiple('');
    onSuccess();
  };

  return (
    <div className="space-y-3 bg-gray-50 p-4 rounded border">
        <h3 className="font-bold text-gray-700 text-sm">Exit Valuation Model</h3>
        
        <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-1 cursor-pointer">
                <input 
                    type="radio" 
                    name="valMethod" 
                    checked={method === 'revenue'} 
                    onChange={() => setMethod('revenue')} 
                />
                Revenue Multiple
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
                <input 
                    type="radio" 
                    name="valMethod" 
                    checked={method === 'ebitda'} 
                    onChange={() => setMethod('ebitda')} 
                />
                EBITDA Multiple
            </label>
        </div>

        <div className="grid grid-cols-1 gap-4">
            {method === 'revenue' && (
                <div>
                    <label className="text-xs text-gray-500">Revenue Multiple (x)</label>
                    <input 
                        type="number" 
                        step="0.1" 
                        className="w-full border p-1 rounded" 
                        value={revenueMultiple} 
                        onChange={e => setRevenueMultiple(e.target.value)} 
                        placeholder="e.g. 5.0"
                    />
                </div>
            )}
            {method === 'ebitda' && (
                <div>
                    <label className="text-xs text-gray-500">EBITDA Multiple (x)</label>
                    <input 
                        type="number" 
                        step="0.1" 
                        className="w-full border p-1 rounded" 
                        value={ebitdaMultiple} 
                        onChange={e => setEbitdaMultiple(e.target.value)} 
                        placeholder="e.g. 12.0"
                    />
                </div>
            )}
        </div>
        <button onClick={handleSave} className="w-full bg-purple-600 text-white py-1 rounded text-sm font-bold">Add Valuation Logic</button>
    </div>
  );
}
```

### 6. `frontend/lib/api.ts`
*   **Updates:**
    *   Updated `createValuation` signature to include `date_applied`.

```typescript
import axios from 'axios';

const API_URL = 'http://localhost:8000';

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
  current_debt: number | string;
  total_value: number | string;
  is_insolvent: boolean;
}

export interface SimulationResult {
  labels: string[];
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
  createValuation: async (item: { plan_id: string, revenue_multiple?: number, ebitda_multiple?: number, date_applied?: string }) => 
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
```

