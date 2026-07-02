"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface VolatilityConfig {
  volatility_type: string;
  target_mean?: string;
  [key: string]: any;
}

interface FinancialItem {
  id: string;
  revenue_name?: string;
  expense_name?: string;
  value: string;
  volatility_configs?: VolatilityConfig[];
  growth_rate_percent?: string;
}

interface Plan {
  id: string;
  plan_name: string;
  tenant_id: string;
}

export default function PlanDashboard() {
  const params = useParams();
  const router = useRouter();
  const planId = params?.planId as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [revenueItems, setRevenueItems] = useState<FinancialItem[]>([]);
  const [expenseItems, setExpenseItems] = useState<FinancialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;

    const fetchPlanData = async () => {
      try {
        setLoading(true);
        // Fetch plan details
        const res = await fetch(`/api/plans/${planId}`);
        if (!res.ok) {
          throw new Error("Failed to fetch plan details");
        }
        const data = await res.json();
        setPlan(data);
        
        // Fetch revenue items
        const revRes = await fetch(`/api/plans/${planId}/revenue`);
        if (revRes.ok) {
          const revData = await revRes.json();
          setRevenueItems(revData);
        } else {
          setRevenueItems(data.revenue_items || []);
        }

        // Fetch expense items
        const expRes = await fetch(`/api/plans/${planId}/expenses`);
        if (expRes.ok) {
          const expData = await expRes.json();
          setExpenseItems(expData);
        } else {
          setExpenseItems(data.expense_items || []);
        }
      } catch (err: any) {
        setError(err.message || "An error occurred while loading the plan.");
      } finally {
        setLoading(false);
      }
    };

    fetchPlanData();
  }, [planId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm font-medium text-slate-600">Loading plan dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-md border border-slate-200 text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Error Loading Plan</h2>
          <p className="text-slate-600 mb-6">{error || "Plan not found."}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const formatCurrency = (valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val)) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between mb-8 border-b border-slate-200 pb-5">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
              {plan.plan_name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Plan ID: <span className="font-mono text-xs">{plan.id}</span>
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
            <Link
              href={`/plan/${planId}/inputs`}
              className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Edit Inputs
            </Link>
            <Link
              href={`/plan/${planId}/simulation`}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Run Simulation
            </Link>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Revenue Streams */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Revenue Streams</h3>
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {revenueItems.length} Active
              </span>
            </div>

            {revenueItems.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                <p className="text-sm text-slate-500">No revenue streams configured.</p>
                <Link
                  href={`/plan/${planId}/inputs`}
                  className="mt-3 inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                >
                  Add Revenue Stream &rarr;
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {revenueItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg border border-slate-100 bg-slate-50 hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-slate-900">
                          {item.revenue_name || "Unnamed Revenue"}
                        </h4>
                        <p className="text-sm text-slate-500 mt-1">
                          Value: {formatCurrency(item.value)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          +{item.volatility_configs && item.volatility_configs.length > 0
                            ? item.volatility_configs
                                .filter((c: any) => c && c.volatility_type)
                                .map((c: any) => c.target_mean || '0.0')
                                .join('%, +') + '% / mo'
                            : `${item.growth_rate_percent || '0.0'}% / mo`
                          }
                        </p>
                      </div>
                    </div>
                    {item.volatility_configs && item.volatility_configs.length > 0 && (
                      <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 mt-2">
                        Risk: {item.volatility_configs
                          .filter((c: any) => c && c.volatility_type)
                          .map((c: any) => {
                            const type = c.volatility_type;
                            if (type === 'flat') return 'Simple';
                            if (type === 'nrig') return 'Comprehensive';
                            if (type === 'student_t') return 'Student T';
                            if (type === 'normal') return 'Normal';
                            return type;
                          })
                          .join(', ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expense Streams */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Expense Streams</h3>
              <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {expenseItems.length} Active
              </span>
            </div>

            {expenseItems.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                <p className="text-sm text-slate-500">No expense streams configured.</p>
                <Link
                  href={`/plan/${planId}/inputs`}
                  className="mt-3 inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                >
                  Add Expense Stream &rarr;
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {expenseItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg border border-slate-100 bg-slate-50 hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-slate-900">
                          {item.expense_name || "Unnamed Expense"}
                        </h4>
                        <p className="text-sm text-slate-500 mt-1">
                          Value: {formatCurrency(item.value)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          +{item.volatility_configs && item.volatility_configs.length > 0
                            ? item.volatility_configs
                                .filter((c: any) => c && c.volatility_type)
                                .map((c: any) => c.target_mean || '0.0')
                                .join('%, +') + '% / mo'
                            : `${item.growth_rate_percent || '0.0'}% / mo`
                          }
                        </p>
                      </div>
                    </div>
                    {item.volatility_configs && item.volatility_configs.length > 0 && (
                      <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 mt-2">
                        Risk: {item.volatility_configs
                          .filter((c: any) => c && c.volatility_type)
                          .map((c: any) => {
                            const type = c.volatility_type;
                            if (type === 'flat') return 'Simple';
                            if (type === 'nrig') return 'Comprehensive';
                            if (type === 'student_t') return 'Student T';
                            if (type === 'normal') return 'Normal';
                            return type;
                          })
                          .join(', ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
