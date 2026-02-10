'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import DeleteButton from '@/components/ui/DeleteButton';
import { api, RevenueItem, ExpenseItem, FinancialPlan, CapitalInjection, StaffingRole, Company } from '@/lib/api';
import { getCurrencySymbol } from '@/lib/currency';

// IMPORT ALL FORMS
import RevenueForm from '@/components/forms/RevenueForm';
import ExpenseForm from '@/components/forms/ExpenseForm';
import CapitalGrowthForm from '@/components/forms/CapitalGrowthForm';
import CapitalForm from '@/components/forms/CapitalForm';
import CapitalList from '@/components/forms/CapitalList'; 
import DividendForm from '@/components/forms/DividendForm';
import CreditForm from '@/components/forms/CreditForm';
import ValuationForm from '@/components/forms/ValuationForm';
import StaffingForm from '@/components/forms/StaffingForm';
import EventList from '@/components/EventList';
import SuccessTaxForm from '@/components/forms/SuccessTaxForm';

type TabType = 'operations' | 'capital' | 'settings' | 'events';

export default function InputsPage({ params }: { params: { planId: string } }) {
  const { planId } = params;
  const [plan, setPlan] = useState<FinancialPlan | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('operations');
  
  // Lists Data
  const [revenueItems, setRevenueItems] = useState<RevenueItem[]>([]);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [capitalItems, setCapitalItems] = useState<CapitalInjection[]>([]);
  const [staffingRoles, setStaffingRoles] = useState<StaffingRole[]>([]);
  
  // New State for Opening Balance
  const [initialCash, setInitialCash] = useState("0");

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Edit State
  const [editingRevenue, setEditingRevenue] = useState<RevenueItem | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);

  // Derived Currency Symbol
  const currencySymbol = plan ? getCurrencySymbol(plan.currency_code) : "$";

  const fetchData = async () => {
    // Note: We don't set loading=true here to avoid full page flicker on updates
    // only initial load sets it.
    try {
      // 1. Fetch Plan (Critical) - Only if not already loaded or explicit refresh needed
      if (!plan) {
        try {
            const p = await api.getPlan(planId);
            setPlan(p);
            // Ensure we handle potential number/string mismatch safely
            setInitialCash(p.initial_cash ? String(p.initial_cash) : "0");

            if (p.company_id) {
                try {
                    const c = await api.getCompany(p.company_id);
                    setCompany(c);
                } catch (e) {
                    console.error("Failed to fetch company", e);
                }
            }
        } catch (e) {
            console.error("Failed to load plan", e);
            setErrorMsg("Plan not found or API error");
            setLoading(false);
            return;
        }
      }

      // 2. Fetch Other Data (Non-Critical or Partial)
      const results = await Promise.allSettled([
        api.getRevenueItems(planId),
        api.getExpenseItems(planId),
        api.getCapitalInjections(planId),
        api.getStaffingRoles(planId)
      ]);

      // Handle Results
      if (results[0].status === 'fulfilled') setRevenueItems(results[0].value);
      if (results[1].status === 'fulfilled') setExpenseItems(results[1].value);
      if (results[2].status === 'fulfilled') setCapitalItems(results[2].value);
      
      if (results[3].status === 'fulfilled') {
          setStaffingRoles(results[3].value);
      } else {
          console.error("Failed to load staffing roles", results[3].reason);
      }

      setEditingRevenue(null);
      setEditingExpense(null);

    } catch (error) {
      console.error("Unexpected error loading inputs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [planId]);

  // Handlers for StaffingForm
  const handleSaveRole = async (roleData: Omit<StaffingRole, "id" | "plan_id"> & { id?: string }) => {
    try {
        if (roleData.id) {
           // Update
           await api.updateStaffingRole({ 
               ...roleData, 
               id: roleData.id, 
               plan_id: planId 
           } as StaffingRole);
        } else {
           // Create
           await api.createStaffingRole({ 
               ...roleData, 
               plan_id: planId 
           });
        }
        await fetchData(); // Refresh data
    } catch (err) {
        console.error("Error saving role:", err);
        throw err; // Let form handle error display
    }
  };

  const handleDeleteRole = async (id: string) => {
    try {
        await api.deleteStaffingRole(id);
        await fetchData();
    } catch (err) {
        console.error("Error deleting role:", err);
        throw err;
    }
  };

  // Handler for Initial Cash
  const handleSaveInitialCash = async () => {
    try {
        console.log("Saving Initial Cash Payload:", { initial_cash: initialCash });
        
        // Update the plan with the new initial_cash value
        // Ensure strictly string to match API requirements
        await api.updatePlan(planId, { initial_cash: String(initialCash) });
        
        window.alert("Opening Balance Saved");

        // Refresh the plan data to ensure sync
        const p = await api.getPlan(planId);
        setPlan(p);
        setInitialCash(p.initial_cash ? String(p.initial_cash) : "0");

        await fetchData();
    } catch (err) {
        console.error("Error saving initial cash:", err);
        window.alert("Failed to save");
    }
  };

  if (loading) return <Layout>Loading...</Layout>;
  if (errorMsg || !plan) return <Layout>{errorMsg || "Plan not found"}</Layout>;

  return (
    <Layout>
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Plan {plan.plan_name} <span className="text-gray-500 font-normal">for {company?.company_name}</span>
            <span className="text-gray-400 text-sm">[{plan.currency_code}]</span>
          </h1>
          <p className="text-gray-500 text-sm">Plan ID: {plan.id}</p>
        </div>
        <a 
          href={`/plan/${planId}/results`}
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium shadow-sm transition-colors"
        >
          View Projections &rarr;
        </a>
      </div>

      {/* TABS NAVIGATION */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('operations')}
            className={`${
              activeTab === 'operations'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Operations (P&L)
          </button>

          <button
            onClick={() => setActiveTab('capital')}
            className={`${
              activeTab === 'capital'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Capital Structure
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`${
              activeTab === 'settings'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Treasury & Valuation
          </button>

          <button
            onClick={() => setActiveTab('events')}
            className={`${
              activeTab === 'events'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Swan Events
          </button>
        </nav>
      </div>

      {/* --- TAB CONTENT: OPERATIONS --- */}
      {activeTab === 'operations' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
          
          {/* REVENUE COLUMN */}
          <section className="space-y-6">
            <Card id="revenue-form">
                <h2 className="text-xl font-bold mb-4 text-blue-600 flex items-center gap-2">
                    Revenue Streams
                </h2>
                <RevenueForm 
                    planId={planId} 
                    onSuccess={fetchData} 
                    itemToEdit={editingRevenue}
                    onCancel={() => setEditingRevenue(null)}
                    currencySymbol={currencySymbol}
                />
            </Card>
            
            <div className="space-y-4">
                {revenueItems.map((item) => (
                <Card key={item.id} className={`border-l-4 transition-all ${editingRevenue?.id === item.id ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200' : 'border-blue-500 hover:shadow-md'}`}>
                    <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-gray-900">{item.revenue_name}</h3>
                        <p className="text-sm text-gray-600">{item.source} • {item.frequency}</p>
                        {item.volatility_type !== 'none' && (
                            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 mt-2">
                                Risk: {item.volatility_type}
                            </span>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-lg">{currencySymbol}{Number(item.initial_amount).toLocaleString()}</p>
                        <p className="text-xs font-medium text-green-600">+{item.growth_rate_percent}% / mo</p>
                    </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
                    <span>Starts Month: {item.start_month}</span>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => {
                                setEditingRevenue(item);
                                document.getElementById('revenue-form')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="text-blue-600 hover:text-blue-800 font-semibold"
                        >
                            Edit
                        </button>
                        <span className="text-gray-300">|</span>
                        <DeleteButton onDelete={async () => {
                            await api.deleteRevenueItem(item.id);
                            fetchData();
                        }} />
                    </div>
                    </div>
                </Card>
                ))}
                {revenueItems.length === 0 && (
                    <div className="text-center p-8 text-gray-400 italic bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        No revenue streams added yet.
                    </div>
                )}
            </div>
          </section>

          {/* EXPENSES COLUMN */}
          <section className="space-y-6">
            <Card id="expense-form">
                <h2 className="text-xl font-bold mb-4 text-red-600">Expenses</h2>
                <ExpenseForm 
                    planId={planId} 
                    onSuccess={fetchData} 
                    itemToEdit={editingExpense}
                    onCancel={() => setEditingExpense(null)}
                    currencySymbol={currencySymbol}
                />
            </Card>

            <div className="space-y-4">
                {expenseItems.map((item) => (
                <Card key={item.id} className={`border-l-4 transition-all ${editingExpense?.id === item.id ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200' : 'border-red-500 hover:shadow-md'}`}>
                    <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-gray-900">{item.expense_name}</h3>
                        <p className="text-sm text-gray-600">{item.category} • {item.frequency}</p>
                        {item.volatility_type !== 'none' && (
                             <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 mt-2">
                                Risk: {item.volatility_type}
                            </span>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-lg">{currencySymbol}{Number(item.initial_amount).toLocaleString()}</p>
                        <p className="text-xs font-medium text-red-600">+{item.growth_rate_percent}% / mo</p>
                    </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
                    <span>Starts Month: {item.start_month}</span>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => {
                                setEditingExpense(item);
                                document.getElementById('expense-form')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="text-blue-600 hover:text-blue-800 font-semibold"
                        >
                            Edit
                        </button>
                        <span className="text-gray-300">|</span>
                        <DeleteButton onDelete={async () => {
                            await api.deleteExpenseItem(item.id);
                            fetchData();
                        }} />
                    </div>
                    </div>
                </Card>
                ))}
                 {expenseItems.length === 0 && (
                    <div className="text-center p-8 text-gray-400 italic bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        No expenses added yet.
                    </div>
                )}
            </div>
          </section>

          {/* STAFFING COLUMN (Full Width) */}
          <div className="col-span-1 lg:col-span-2 mt-8">
                <StaffingForm 
                    planId={planId} 
                    initialRoles={staffingRoles}
                    currency={plan?.currency_code || "USD"}
                    onSave={handleSaveRole}
                    onDelete={handleDeleteRole}
                />
            </div>
        </div>
      )}

      {/* --- TAB CONTENT: CAPITAL STRUCTURE --- */}
      {activeTab === 'capital' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
            
            {/* EQUITY / CAPITAL INJECTIONS */}
            <section className="space-y-6">
                <Card>
                    <h2 className="text-xl font-bold mb-4 text-green-600">Equity & Capital Injections</h2>
                    <p className="text-sm text-gray-500 mb-6">Add one-time cash injections (e.g. Seed rounds, Owner contributions).</p>
                    
                    {/* OPENING BALANCE INPUT */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Opening Cash Balance ({currencySymbol})
                        </label>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                value={initialCash}
                                onChange={(e) => setInitialCash(e.target.value)}
                                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 border"
                                placeholder="0.00"
                            />
                            <button
                                onClick={handleSaveInitialCash}
                                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-medium"
                            >
                                Save
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Starting cash on hand at Month 0.
                        </p>
                    </div>

                    {/* INPUT FORM */}
                    <CapitalForm planId={planId} onSuccess={fetchData} currencySymbol={currencySymbol} />

                    {/* LIST OF ITEMS */}
                    <CapitalList items={capitalItems} onDelete={fetchData} />
                </Card>
            </section>

            {/* DEBT & DIVIDENDS */}
            <section className="space-y-6">
                <Card>
                    <h2 className="text-xl font-bold mb-4 text-orange-600">Debt & Credit Facilities</h2>
                     <p className="text-sm text-gray-500 mb-6">Manage lines of credit, interest rates, and loan terms.</p>
                    <CreditForm planId={planId} currencySymbol={currencySymbol} />
                </Card>

                <Card>
                    <h2 className="text-xl font-bold mb-4 text-cyan-600">Dividends</h2>
                    <p className="text-sm text-gray-500 mb-6">Set rules for profit distribution to shareholders.</p>
                    <DividendForm planId={planId} currencySymbol={currencySymbol} />
                </Card>
            </section>
        </div>
      )}

      {/* --- TAB CONTENT: SETTINGS & TREASURY --- */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
             {/* TREASURY */}
             <section>
                 <Card>
                    <h2 className="text-xl font-bold mb-4 text-indigo-600">Treasury Management</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Configure how idle cash is invested. Set a minimum cash buffer and an interest yield for surplus cash.
                    </p>
                    <CapitalGrowthForm planId={planId} onSuccess={fetchData} />
                 </Card>
            </section>

             {/* VALUATION & SUCCESS TAX */}
             <section className="space-y-6">
                 <Card>
                    <h2 className="text-xl font-bold mb-4 text-purple-600">Valuation Settings</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Define the multiples (Revenue/EBITDA) used to estimate your company's value over time.
                    </p>
                    <ValuationForm planId={planId} onSuccess={fetchData} />
                 </Card>

                 {/* SUCCESS TAX FORM */}
                 {plan && <SuccessTaxForm plan={plan} onSuccess={fetchData} />}
            </section>
        </div>
      )}

      {/* --- TAB CONTENT: SWAN EVENTS --- */}
      {activeTab === 'events' && (
        <div className="animate-in fade-in duration-300">
          <Card>
             <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  Swan Events (Risk Scenarios)
                </h2>
                <p className="text-sm text-gray-500">
                  Define specific risk events (positive or negative) for {company?.company_name || 'this company'}.
                </p>
             </div>
             <EventList 
               fundId={null} 
               companies={company ? [company] : []} 
               funds={[]} 
               companyId={company?.id}
             />
          </Card>
        </div>
      )}
    </Layout>
  );
}
