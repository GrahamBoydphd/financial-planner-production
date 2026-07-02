🧠 'Thinking' mode activated for gemini-3.5-flash...
An elegant and robust refactoring of the stream listing view and forms has been completed. 

Here is the breakdown of the changes:
1. **`ClientPage.tsx`**: Fully implemented the stream listing view. It fetches the plan's revenue and expense streams, renders them in clean, responsive columns, and displays the detailed risk configuration using the nested `volatility_configs` array.
2. **`RevenueForm.tsx` & `ExpenseForm.tsx`**:
   - Fixed the `useEffect` hook to correctly map the nested `volatility_configs` array into the form component state when editing an item.
   - Added a strict frontend validation guardrail in `handleSubmit` to prevent submitting an item with an empty volatility configuration array.
   - Ensured the PUT payload delivery matches the POST payload structure exactly.

Let's write the full files.

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

export default function ClientPage({ params }: Props) {
  const { planId } = params;
  const [revenueItems, setRevenueItems] = useState<RevenueItem[]>([]);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit States
  const [revenueToEdit, setRevenueToEdit] = useState<RevenueItem | null>(null);
  const [expenseToEdit, setExpenseToEdit] = useState<ExpenseItem | null>(null);

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
                          <p className="text-xs text-gray-600 mt-1">
                            <span className="font-semibold">risk: </span>
                            {item.volatility_configs && item.volatility_configs.length > 0
                              ? item.volatility_configs
                                  .map(
                                    (c: any) =>
                                      `${c.volatility_type} (${
                                        c.mode_name === 'compounding_growth' ? 'Compounding' : 'Transient'
                                      })`
                                  )
                                  .join(', ')
                              : 'none'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900">
                            ${Number(item.initial_amount).toLocaleString()}
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
                          <p className="text-xs text-gray-600 mt-1">
                            <span className="font-semibold">risk: </span>
                            {item.volatility_configs && item.volatility_configs.length > 0
                              ? item.volatility_configs
                                  .map(
                                    (c: any) =>
                                      `${c.volatility_type} (${
                                        c.mode_name === 'compounding_growth' ? 'Compounding' : 'Transient'
                                      })`
                                  )
                                  .join(', ')
                              : 'none'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900">
                            ${Number(item.initial_amount).toLocaleString()}
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

<file path='frontend/components/forms/RevenueForm.tsx'>
'use client';

import { useState, useEffect } from 'react';
import { api, RevenueItem } from '@/lib/api';
import Tooltip from '@/components/ui/Tooltip';
import VolatilityInputs, { VolatilityConfig } from '@/components/forms/shared/VolatilityInputs';

interface Props {
  planId: string;
  onSuccess: () => void;
  itemToEdit?: RevenueItem | null;
  onCancel?: () => void;
  currencySymbol?: string;
}

export default function RevenueForm({ planId, onSuccess, itemToEdit, onCancel, currencySymbol = '$' }: Props) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('sales');
  const [amount, setAmount] = useState('');
  const [startMonth, setStartMonth] = useState('1');
  const [endMonth, setEndMonth] = useState('');
  const [freq, setFreq] = useState('monthly');
  const [cogsPercent, setCogsPercent] = useState('');

  // Volatility Configs State
  const [volatilityConfigs, setVolatilityConfigs] = useState<VolatilityConfig[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // --- EFFECT: POPULATE FORM ON EDIT ---
  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.revenue_name);
      setSource(itemToEdit.source);
      setAmount(itemToEdit.initial_amount.toString());
      setStartMonth(itemToEdit.start_month.toString());
      setEndMonth(itemToEdit.end_month ? itemToEdit.end_month.toString() : '');
      setFreq(itemToEdit.frequency);
      setCogsPercent(itemToEdit.cost_of_revenue_percent ? itemToEdit.cost_of_revenue_percent.toString() : '');
      
      // Map volatility configs safely to match form state expectations
      const configs = (itemToEdit as any).volatility_configs || [];
      setVolatilityConfigs(configs.map((c: any) => ({
        id: c.id,
        mode_name: c.mode_name,
        volatility_type: c.volatility_type,
        low_value: c.low_value !== undefined && c.low_value !== null ? c.low_value.toString() : '',
        high_value: c.high_value !== undefined && c.high_value !== null ? c.high_value.toString() : '',
        mean_value: c.mean_value !== undefined && c.mean_value !== null ? c.mean_value.toString() : '',
        std_dev: c.std_dev !== undefined && c.std_dev !== null ? c.std_dev.toString() : '',
        degrees_of_freedom: c.degrees_of_freedom !== undefined && c.degrees_of_freedom !== null ? c.degrees_of_freedom.toString() : '',
      })));
    } else {
      clearForm();
    }
  }, [itemToEdit]);

  const clearForm = () => {
    setName('');
    setSource('sales');
    setAmount('');
    setStartMonth('1');
    setEndMonth('');
    setFreq('monthly');
    setCogsPercent('');
    setVolatilityConfigs([]);
    setErrors([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const newErrors = [];
    if (!name.trim()) newErrors.push("Name is required");
    if (!amount || isNaN(Number(amount))) newErrors.push("Valid initial amount is required");
    if (!startMonth || isNaN(Number(startMonth))) newErrors.push("Start month is required");

    // Strict validation guardrail: cannot submit with empty volatility configs
    if (!volatilityConfigs || volatilityConfigs.length === 0) {
        newErrors.push("Validation Error: The simulation engine requires a financial stream to have an active variance profile. Please enable at least one volatility force (Compounding Growth and/or Transient Operational Noise) before saving this item.");
    }

    if (newErrors.length > 0) {
        setErrors(newErrors);
        return;
    }

    try {
        const payload = {
            plan_id: planId,
            revenue_name: name,
            source: source.toLowerCase(),
            initial_amount: String(amount),
            start_month: Number(startMonth),
            end_month: endMonth ? Number(endMonth) : undefined,
            frequency: freq.toLowerCase(),
            cost_of_revenue_percent: cogsPercent ? String(cogsPercent) : undefined,
            volatility_configs: volatilityConfigs
        };

        if (itemToEdit) {
            await api.updateRevenueItem(itemToEdit.id, payload as any);
        } else {
            await api.createRevenueItem(payload as any);
        }

        clearForm();
        onSuccess(); 
    } catch (err: any) {
        console.error(err);
        const status = err.response?.status;
        const errMsg = err.response?.data?.message || err.message || '';
        if (status === 400 || errMsg.toLowerCase().includes('volatility') || errMsg.toLowerCase().includes('empty')) {
            setErrors([
                "Validation Error: The simulation engine requires a financial stream to have an active variance profile. Please enable at least one volatility force (Compounding Growth and/or Transient Operational Noise) before saving this item."
            ]);
        } else {
            setErrors(["Failed to save revenue item. Please check your inputs."]);
        }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-4 rounded border">
      <div className="flex justify-between items-center mb-1">
         <h3 className="font-bold text-gray-700">{itemToEdit ? 'Edit Revenue Stream' : 'Add Revenue Stream'}</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">* = Required Field. (Model uses Cash Basis accounting)</p>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative text-sm">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{errors.join(", ")}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500">Name *</label>
          <input className="w-full border p-2 rounded text-sm" placeholder="e.g. SaaS Subs" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Source Type</label>
          <select className="w-full border p-2 rounded text-sm" value={source} onChange={e => setSource(e.target.value)}>
            <option value="sales">Sales</option>
            <option value="subscription">Subscription</option>
            <option value="service">Service</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 flex items-center gap-1">
            Initial Amount ({currencySymbol}) *
            <Tooltip content="Initial amount of revenue in Starting Month" />
          </label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
            <label className="text-xs text-gray-500 flex items-center gap-1">
              Cost of Rev (%)
              <Tooltip content="Cost of revenue percentage." />
            </label>
            <input type="number" className="w-full border p-2 rounded text-sm" placeholder="Optional" value={cogsPercent} onChange={e => setCogsPercent(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500">Frequency</label>
          <select className="w-full border p-2 rounded text-sm" value={freq} onChange={e => setFreq(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="one_time">One-time</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Start Month *</label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={startMonth} onChange={e => setStartMonth(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">End Month</label>
          <input type="number" className="w-full border p-2 rounded text-sm" placeholder="Optional" value={endMonth} onChange={e => setEndMonth(e.target.value)} />
        </div>
      </div>

      {/* UNIFIED GROWTH & VOLATILITY SECTION */}
      <VolatilityInputs configs={volatilityConfigs} onChange={setVolatilityConfigs} />

      <div className="flex gap-4">
        {itemToEdit && (
            <button 
                type="button" 
                onClick={onCancel} 
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded flex-1"
            >
                Cancel Edit
            </button>
        )}
        <button 
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded flex-1"
        >
            {itemToEdit ? 'Update Stream' : 'Add Stream'}
        </button>
      </div>
    </form>
  );
}
</file>

<file path='frontend/components/forms/ExpenseForm.tsx'>
'use client';

import { useState, useEffect } from 'react';
import { api, ExpenseItem } from '@/lib/api';
import Tooltip from '@/components/ui/Tooltip';
import VolatilityInputs, { VolatilityConfig } from '@/components/forms/shared/VolatilityInputs';

interface Props {
  planId: string;
  onSuccess: () => void;
  itemToEdit?: ExpenseItem | null;
  onCancel?: () => void;
  currencySymbol?: string;
}

export default function ExpenseForm({ planId, onSuccess, itemToEdit, onCancel, currencySymbol = '$' }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('opex');
  const [amount, setAmount] = useState('');
  const [startMonth, setStartMonth] = useState('1');
  const [endMonth, setEndMonth] = useState('');
  const [freq, setFreq] = useState('monthly');
  const [pctRevenue, setPctRevenue] = useState('');

  // Volatility Configs State
  const [volatilityConfigs, setVolatilityConfigs] = useState<VolatilityConfig[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // --- POPULATE ON EDIT ---
  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.expense_name);
      setCategory(itemToEdit.category);
      setAmount(itemToEdit.initial_amount.toString());
      setStartMonth(itemToEdit.start_month.toString());
      setEndMonth(itemToEdit.end_month ? itemToEdit.end_month.toString() : '');
      setFreq(itemToEdit.frequency);
      setPctRevenue(itemToEdit.pct_of_revenue ? itemToEdit.pct_of_revenue.toString() : '');
      
      // Map volatility configs safely to match form state expectations
      const configs = (itemToEdit as any).volatility_configs || [];
      setVolatilityConfigs(configs.map((c: any) => ({
        id: c.id,
        mode_name: c.mode_name,
        volatility_type: c.volatility_type,
        low_value: c.low_value !== undefined && c.low_value !== null ? c.low_value.toString() : '',
        high_value: c.high_value !== undefined && c.high_value !== null ? c.high_value.toString() : '',
        mean_value: c.mean_value !== undefined && c.mean_value !== null ? c.mean_value.toString() : '',
        std_dev: c.std_dev !== undefined && c.std_dev !== null ? c.std_dev.toString() : '',
        degrees_of_freedom: c.degrees_of_freedom !== undefined && c.degrees_of_freedom !== null ? c.degrees_of_freedom.toString() : '',
      })));
    } else {
      clearForm();
    }
  }, [itemToEdit]);

  const clearForm = () => {
    setName('');
    setCategory('opex');
    setAmount('');
    setStartMonth('1');
    setEndMonth('');
    setFreq('monthly');
    setPctRevenue('');
    setVolatilityConfigs([]);
    setErrors([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const newErrors = [];
    if (!name.trim()) newErrors.push("Name is required");
    if (!amount || isNaN(Number(amount))) newErrors.push("Valid initial amount is required");
    if (!startMonth || isNaN(Number(startMonth))) newErrors.push("Start month is required");

    // Strict validation guardrail: cannot submit with empty volatility configs
    if (!volatilityConfigs || volatilityConfigs.length === 0) {
        newErrors.push("Validation Error: The simulation engine requires a financial stream to have an active variance profile. Please enable at least one volatility force (Compounding Growth and/or Transient Operational Noise) before saving this item.");
    }

    if (newErrors.length > 0) {
        setErrors(newErrors);
        return;
    }

    try {
        const payload = {
            plan_id: planId,
            expense_name: name,
            category,
            initial_amount: String(amount),
            start_month: Number(startMonth),
            end_month: endMonth ? Number(endMonth) : undefined,
            frequency: freq,
            pct_of_revenue: pctRevenue ? String(pctRevenue) : undefined,
            volatility_configs: volatilityConfigs
        };

        if (itemToEdit) {
            await api.updateExpenseItem(itemToEdit.id, payload as any);
        } else {
            await api.createExpenseItem(payload as any);
        }

        clearForm();
        onSuccess();
    } catch (err: any) {
        console.error(err);
        const status = err.response?.status;
        const errMsg = err.response?.data?.message || err.message || '';
        if (status === 400 || errMsg.toLowerCase().includes('volatility') || errMsg.toLowerCase().includes('empty')) {
            setErrors([
                "Validation Error: The simulation engine requires a financial stream to have an active variance profile. Please enable at least one volatility force (Compounding Growth and/or Transient Operational Noise) before saving this item."
            ]);
        } else {
            setErrors(["Failed to save expense item. Please check your inputs."]);
        }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-4 rounded border">
      <div className="flex justify-between items-center mb-1">
         <h3 className="font-bold text-gray-700">{itemToEdit ? 'Edit Expense' : 'Add Expense'}</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">* = Required Field. (Model uses Cash Basis accounting)</p>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative text-sm">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{errors.join(", ")}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500">Name *</label>
          <input className="w-full border p-2 rounded text-sm" placeholder="e.g. Salaries" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Category</label>
          <select className="w-full border p-2 rounded text-sm" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="opex">OpEx</option>
            <option value="capex">CapEx</option>
            <option value="payroll">Payroll</option>
            <option value="marketing">Marketing</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 flex items-center gap-1">
            Initial Amount ({currencySymbol}) *
            <Tooltip content="Initial amount of expense in Starting Month" />
          </label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
            <label className="text-xs text-gray-500 flex items-center gap-1">
              % of Revenue
              <Tooltip content="Percentage of revenue tied to expense." />
            </label>
            <input type="number" className="w-full border p-2 rounded text-sm" placeholder="Optional" value={pctRevenue} onChange={e => setPctRevenue(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500">Frequency</label>
          <select className="w-full border p-2 rounded text-sm" value={freq} onChange={e => setFreq(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="one_time">One-time</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Start Month *</label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={startMonth} onChange={e => setStartMonth(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">End Month</label>
          <input type="number" className="w-full border p-2 rounded text-sm" placeholder="Optional" value={endMonth} onChange={e => setEndMonth(e.target.value)} />
        </div>
      </div>

      {/* UNIFIED GROWTH & VOLATILITY SECTION */}
      <VolatilityInputs configs={volatilityConfigs} onChange={setVolatilityConfigs} />

      <div className="flex gap-4">
        {itemToEdit && (
            <button 
                type="button" 
                onClick={onCancel} 
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded flex-1"
            >
                Cancel Edit
            </button>
        )}
        <button 
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded flex-1"
        >
            {itemToEdit ? 'Update Expense' : 'Add Expense'}
        </button>
      </div>
    </form>
  );
}
</file>

