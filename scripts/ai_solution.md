🤖 Generating standard response via gemini-3.1-pro-preview...
```xml
<file path='frontend/app/plan/[planId]/inputs/ClientPage.tsx'>
'use client';

import { useState, useEffect } from 'react';
import { api, RevenueItem, ExpenseItem } from '@/lib/api';
import RevenueForm from '@/components/forms/RevenueForm';
import ExpenseForm from '@/components/forms/ExpenseForm';
import Link from 'next/link';

interface Props {
  params: {
    planId: string;
  };
}

const getOperatorSymbol = (op?: string) => {
  if (!op) return '';
  if (op.includes('greater_than')) return '>';
  if (op.includes('less_than')) return '<';
  return op;
};

export default function ClientPage({ params }: Props) {
  const { planId } = params;
  const [revenueItems, setRevenueItems] = useState<RevenueItem[]>([]);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit States
  const [revenueToEdit, setRevenueToEdit] = useState<RevenueItem | null>(null);
  const [expenseToEdit, setExpenseToEdit] = useState<ExpenseItem | null>(null);

  const currencySymbol = '$';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [revs, exps] = await Promise.all([
        api.getRevenueItems(planId),
        api.getExpenseItems(planId),
      ]);
      setRevenueItems(revs || []);
      setExpenseItems(exps || []);
    } catch (err: any) {
      console.error('Failed to fetch plan inputs:', err);
      setError('Failed to load financial streams. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [planId]);

  const handleDeleteRevenue = async (id: string) => {
    if (!confirm('Are you sure you want to delete this revenue stream?')) return;
    try {
      await api.deleteRevenueItem(id);
      if (revenueToEdit?.id === id) {
        setRevenueToEdit(null);
      }
      fetchData();
    } catch (err) {
      console.error('Failed to delete revenue item:', err);
      alert('Failed to delete revenue stream.');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense stream?')) return;
    try {
      await api.deleteExpenseItem(id);
      if (expenseToEdit?.id === id) {
        setExpenseToEdit(null);
      }
      fetchData();
    } catch (err) {
      console.error('Failed to delete expense item:', err);
      alert('Failed to delete expense stream.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading financial streams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Link href={`/plan/${planId}`} className="hover:text-green-600 transition-colors">
                &larr; Back to Plan Dashboard
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Plan Inputs & Volatility</h1>
            <p className="mt-1 text-sm text-gray-500">
              Configure your revenue and expense streams with non-ergodic path-dependent volatility.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative text-sm">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Forms */}
          <div className="lg:col-span-5 space-y-8">
            {/* Revenue Form Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <RevenueForm
                planId={planId}
                itemToEdit={revenueToEdit}
                onSuccess={() => {
                  setRevenueToEdit(null);
                  fetchData();
                }}
                onCancel={() => setRevenueToEdit(null)}
              />
            </div>

            {/* Expense Form Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <ExpenseForm
                planId={planId}
                itemToEdit={expenseToEdit}
                onSuccess={() => {
                  setExpenseToEdit(null);
                  fetchData();
                }}
                onCancel={() => setExpenseToEdit(null)}
              />
            </div>
          </div>

          {/* Right Column: Lists */}
          <div className="lg:col-span-7 space-y-8">
            {/* Revenue Streams List */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center justify-between">
                <span>Revenue Streams</span>
                <span className="text-xs font-semibold bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full">
                  {revenueItems.length} Active
                </span>
              </h2>

              {revenueItems.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-500">No revenue streams configured yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {revenueItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border transition-all ${
                        revenueToEdit?.id === item.id
                          ? 'border-green-500 bg-green-50/30 ring-1 ring-green-500'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-900">{item.revenue_name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Type: <span className="capitalize">{item.source}</span> | Freq: <span className="capitalize">{item.frequency}</span>
                          </p>
                          <p className="text-xs text-gray-500">
                            Months: {item.start_month} to {item.end_month || 'End'}
                          </p>
                          
                          {/* Multi-Phase Summary Block */}
                          {item.phases?.map((phase: any) => {
                              const triggerLabel = phase.phase_sequence === 1 
                                  ? "Phase 1 Baseline" 
                                  : (phase.trigger_month !== null && phase.trigger_month !== undefined && phase.trigger_month !== '')
                                      ? `Phase ${phase.phase_sequence} (Month ${phase.trigger_month})`
                                      : `Phase ${phase.phase_sequence} (YTD ${getOperatorSymbol(phase.trigger_operator)} ${currencySymbol}${phase.trigger_threshold && !isNaN(Number(phase.trigger_threshold)) ? Number(phase.trigger_threshold).toLocaleString() : '0'})`;
                              
                              const riskLabels = phase.volatility_configs && phase.volatility_configs.length > 0
                                  ? [...phase.volatility_configs]
                                      .sort((a: any, b: any) => a.mode_name === 'compounding_growth' ? -1 : (b.mode_name === 'compounding_growth' ? 1 : 0))
                                      .filter((c: any) => c && c.volatility_type)
                                      .map((c: any) => {
                                          if (c.volatility_type === 'flat') return 'Simple';
                                          if (c.volatility_type === 'nrig') return 'Comprehensive';
                                          if (c.volatility_type === 'student_t') return 'Student T';
                                          if (c.volatility_type === 'normal') return 'Normal';
                                          return c.volatility_type;
                                      })
                                      .join(', ') || 'None'
                                  : 'None';

                              const growthRate = parseFloat(phase.growth_rate_percent || '0');
                              const growthSign = growthRate >= 0 ? '+' : '';
                              const formattedGrowth = `${growthSign}${growthRate.toFixed(2)}`;

                              return (
                                  <div key={phase.phase_sequence} className="text-xs text-gray-600 mt-1 border-l-2 border-purple-200 pl-2">
                                      <span className="font-semibold text-purple-700">{triggerLabel}:</span> Risk: {riskLabels} ({formattedGrowth}% / mo)
                                  </div>
                              );
                          })}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900">
                            {currencySymbol}{Number(item.initial_amount).toLocaleString()}
                          </span>
                          {item.cost_of_revenue_percent && (
                            <p className="text-xs text-red-500 mt-0.5">
                              COGS: {item.cost_of_revenue_percent}%
                            </p>
                          )}
                          <div className="flex gap-2 mt-3 justify-end">
                            <button
                              onClick={() => {
                                setRevenueToEdit(item);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="text-xs font-medium text-green-600 hover:text-green-700 transition-colors"
                            >
                              Edit
                            </button>
                            <span className="text-gray-300 text-xs">|</span>
                            <button
                              onClick={() => handleDeleteRevenue(item.id)}
                              className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Expense Streams List */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center justify-between">
                <span>Expense Streams</span>
                <span className="text-xs font-semibold bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full">
                  {expenseItems.length} Active
                </span>
              </h2>

              {expenseItems.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-500">No expense streams configured yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {expenseItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border transition-all ${
                        expenseToEdit?.id === item.id
                          ? 'border-orange-500 bg-orange-50/30 ring-1 ring-orange-500'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-900">{item.expense_name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Category: <span className="capitalize">{item.category}</span> | Freq: <span className="capitalize">{item.frequency}</span>
                          </p>
                          <p className="text-xs text-gray-500">
                            Months: {item.start_month} to {item.end_month || 'End'}
                          </p>
                          
                          {/* Multi-Phase Summary Block */}
                          {item.phases?.map((phase: any) => {
                              const triggerLabel = phase.phase_sequence === 1 
                                  ? "Phase 1 Baseline" 
                                  : (phase.trigger_month !== null && phase.trigger_month !== undefined && phase.trigger_month !== '')
                                      ? `Phase ${phase.phase_sequence} (Month ${phase.trigger_month})`
                                      : `Phase ${phase.phase_sequence} (YTD ${getOperatorSymbol(phase.trigger_operator)} ${currencySymbol}${phase.trigger_threshold && !isNaN(Number(phase.trigger_threshold)) ? Number(phase.trigger_threshold).toLocaleString() : '0'})`;
                              
                              const riskLabels = phase.volatility_configs && phase.volatility_configs.length > 0
                                  ? [...phase.volatility_configs]
                                      .sort((a: any, b: any) => a.mode_name === 'compounding_growth' ? -1 : (b.mode_name === 'compounding_growth' ? 1 : 0))
                                      .filter((c: any) => c && c.volatility_type)
                                      .map((c: any) => {
                                          if (c.volatility_type === 'flat') return 'Simple';
                                          if (c.volatility_type === 'nrig') return 'Comprehensive';
                                          if (c.volatility_type === 'student_t') return 'Student T';
                                          if (c.volatility_type === 'normal') return 'Normal';
                                          return c.volatility_type;
                                      })
                                      .join(', ') || 'None'
                                  : 'None';

                              const growthRate = parseFloat(phase.growth_rate_percent || '0');
                              const growthSign = growthRate >= 0 ? '+' : '';
                              const formattedGrowth = `${growthSign}${growthRate.toFixed(2)}`;

                              return (
                                  <div key={phase.phase_sequence} className="text-xs text-gray-600 mt-1 border-l-2 border-purple-200 pl-2">
                                      <span className="font-semibold text-purple-700">{triggerLabel}:</span> Risk: {riskLabels} ({formattedGrowth}% / mo)
                                  </div>
                              );
                          })}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900">
                            {currencySymbol}{Number(item.initial_amount).toLocaleString()}
                          </span>
                          {item.pct_of_revenue && (
                            <p className="text-xs text-blue-500 mt-0.5">
                              {item.pct_of_revenue}% of Rev
                            </p>
                          )}
                          <div className="flex gap-2 mt-3 justify-end">
                            <button
                              onClick={() => {
                                setExpenseToEdit(item);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors"
                            >
                              Edit
                            </button>
                            <span className="text-gray-300 text-xs">|</span>
                            <button
                              onClick={() => handleDeleteExpense(item.id)}
                              className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
</file>
```

