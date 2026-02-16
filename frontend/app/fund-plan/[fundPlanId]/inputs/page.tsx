'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, ExternalLink, Play, CheckCircle, AlertCircle } from 'lucide-react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import { api, Fund, Company, FinancialPlan, FundPlan } from '@/lib/api';

export default function FundPlanInputsPage({ params }: { params: { fundPlanId: string } }) {
  const { fundPlanId } = params;
  const router = useRouter();

  // --- Data State ---
  const [plan, setPlan] = useState<FundPlan | null>(null);
  const [fund, setFund] = useState<Fund | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allPlans, setAllPlans] = useState<FinancialPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- Form State ---
  // Maps CompanyID -> PlanID
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [planName, setPlanName] = useState('');

  // 1. Initial Load
  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch the specific plan first
        const planData = await api.getFundPlan(fundPlanId);
        setPlan(planData);
        setPlanName(planData.plan_name);
        setSelections(planData.selected_plans || {});

        // Fetch related data
        const [fundData, companiesData, allPlansData] = await Promise.all([
          api.getFund(planData.fund_id),
          api.getCompanies(),
          api.getPlans()
        ]);

        setFund(fundData);
        // Filter companies belonging to this fund
        setCompanies(companiesData.filter(c => c.fund_id === planData.fund_id));
        setAllPlans(allPlansData);

      } catch (e) {
        console.error("Failed to load plan data", e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [fundPlanId]);

  // 2. Logic: Save & Run
  const handleRunSimulation = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      // Update the plan with current selections and name
      await api.updateFundPlan(fundPlanId, {
        plan_name: planName,
        selected_plans: selections
      });

      // Redirect to results
      router.push(`/fund-plan/${fundPlanId}/results`);
    } catch (e) {
      console.error("Failed to save plan", e);
      alert("Failed to save configuration.");
      setSaving(false);
    }
  };

  // 3. Logic: Just Save
  const handleSave = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      await api.updateFundPlan(fundPlanId, {
        plan_name: planName,
        selected_plans: selections
      });
      // Stay on page, just show success (could add toast here)
    } catch (e) {
      console.error("Failed to save", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout>Loading configuration...</Layout>;
  if (!plan || !fund) return <Layout>Plan not found</Layout>;

  // Calculate completion status
  const totalCompanies = companies.length;
  
  // BUGFIX: Filter out ghost keys from deleted companies
  // Only count selections where the company ID actually exists in the current companies list
  const validSelections = Object.keys(selections).filter(companyId => 
    companies.some(c => String(c.id) === String(companyId))
  );
  const selectedCount = validSelections.length;
  
  const isComplete = totalCompanies > 0 && selectedCount === totalCompanies;

  return (
    <Layout>
      <nav className='mb-6'>
        <Link href={`/fund/${fund.id}`} className='text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium transition-colors'>
          <ArrowLeft className='h-4 w-4' />
          Back to Fund Dashboard
        </Link>
      </nav>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-gray-500 font-medium uppercase tracking-wider">{fund.fund_name}</span>
          </div>
          <div className="flex items-center gap-3">
            <input 
              type="text" 
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              className="text-3xl font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none transition-colors px-1 -ml-1"
            />
            <span className="text-gray-400 text-sm">(Click to rename)</span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Configure which financial plan to use for each portfolio company in this scenario.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button 
            onClick={handleRunSimulation}
            disabled={saving}
            className={`px-6 py-2 rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2 text-white
              ${saving ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            <Play size={16} />
            Run Simulation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: Summary Card */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-t-4 border-indigo-500">
            <h3 className="font-bold text-gray-900 mb-4">Configuration Status</h3>
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Companies Linked</span>
              <span className={`text-sm font-bold ${isComplete ? 'text-green-600' : 'text-amber-600'}`}>
                {selectedCount} / {totalCompanies}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
              <div 
                className={`h-2.5 rounded-full ${isComplete ? 'bg-green-500' : 'bg-amber-500'}`} 
                style={{ width: `${totalCompanies > 0 ? (selectedCount / totalCompanies) * 100 : 0}%` }}
              ></div>
            </div>

            {!isComplete && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-2 text-sm text-amber-800">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <p>Some companies do not have a plan selected. They will be treated as having zero revenue/expenses in the simulation.</p>
              </div>
            )}
            
            {isComplete && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-start gap-2 text-sm text-green-800">
                <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                <p>All companies mapped. Ready to simulate.</p>
              </div>
            )}
          </Card>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm text-gray-500">
            <h4 className="font-bold text-gray-700 mb-2">Instructions</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Select the specific financial plan (e.g., "Base Case", "Aggressive") for each company.</li>
              <li>The simulation aggregates these specific trajectories.</li>
              <li>Changes here do not affect the original Company Plans.</li>
            </ul>
          </div>
        </div>

        {/* RIGHT: Matrix */}
        <div className="lg:col-span-2">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Portfolio Composition</h3>
              <span className="text-xs text-gray-500 font-mono">ID: {fundPlanId}</span>
            </div>

            <div className="divide-y divide-gray-100">
              {companies.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No companies in this fund yet.
                </div>
              )}

              {companies.map(co => {
                const coPlans = allPlans.filter(p => p.company_id === co.id);
                const selectedId = selections[co.id];

                return (
                  <div key={co.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      
                      {/* Company Info */}
                      <div className="min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900">{co.company_name}</h4>
                          <Link href={`/company/${co.id}`} target="_blank" className="text-gray-400 hover:text-blue-600">
                            <ExternalLink size={14} />
                          </Link>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{co.industry || 'General'}</p>
                      </div>

                      {/* Plan Selector */}
                      <div className="flex-1">
                        {coPlans.length === 0 ? (
                          <div className="text-sm text-red-500 italic border border-red-100 bg-red-50 p-2 rounded">
                            No financial plans found for this company.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {coPlans.map(p => (
                              <label 
                                key={p.id}
                                className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-all ${
                                  selectedId === p.id 
                                  ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 shadow-sm' 
                                  : 'bg-white border-gray-200 hover:border-indigo-300'
                                }`}
                              >
                                <input 
                                  type="radio" 
                                  name={`plan-${co.id}`}
                                  checked={selectedId === p.id}
                                  onChange={() => setSelections(prev => ({ ...prev, [co.id]: p.id }))}
                                  className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                />
                                <div className="flex flex-col">
                                  <span className={`text-sm font-medium ${selectedId === p.id ? 'text-indigo-900' : 'text-gray-700'}`}>
                                    {p.plan_name}
                                  </span>
                                  <span className="text-[10px] text-gray-500">
                                    Starts Month {p.start_month}
                                  </span>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
