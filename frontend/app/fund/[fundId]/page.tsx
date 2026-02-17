'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import { api, Fund, Company, FundPlan } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BarChart3, Edit2, ArrowRight, Plus, Copy, Play, X, Trash2, Check } from 'lucide-react';
import MoveCompanyModal from '@/components/modals/MoveCompanyModal';
import EventList from "@/components/EventList";

export default function FundPage({ params }: { params: { fundId: string } }) {
  const { fundId } = params;
  const router = useRouter();
  
  // --- Data State ---
  const [fund, setFund] = useState<Fund | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<FundPlan[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- UI State ---
  const [movingCompanyId, setMovingCompanyId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [creatingLoading, setCreatingLoading] = useState(false);

  // --- Editing State ---
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [tempPlanName, setTempPlanName] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [fundData, allCompanies, fundPlans] = await Promise.all([
        api.getFund(fundId),
        api.getCompanies(),
        api.getFundPlans(fundId)
      ]);
      
      setFund(fundData);
      setCompanies(allCompanies.filter(c => c.fund_id === fundId));
      setPlans(fundPlans);
    } catch (e) {
      console.error('Failed to load fund data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fundId]);

  const handleDuplicateCompany = async (id: string) => {
    if(!confirm('Duplicate this company and all its plans?')) return;
    try {
        await api.duplicateCompany(id);
        await loadData();
    } catch(e) {
        console.error(e);
        alert('Failed to duplicate company');
    }
  };

  const handleCreatePlan = async () => {
    if (!newPlanName.trim()) return;
    setCreatingLoading(true);
    try {
      // 1. Fetch all plans to determine defaults (most recent plan for each company)
      const allPlans = await api.getPlans();
      const defaults: Record<string, string> = {};
      
      companies.forEach(c => {
        const cPlans = allPlans.filter(p => p.company_id === c.id);
        // Simple heuristic: take the last one created (assuming ID sort or array order)
        if (cPlans.length > 0) {
          defaults[c.id] = cPlans[cPlans.length - 1].id;
        }
      });

      // 2. Create the Fund Plan
      const newPlan = await api.createFundPlan({
        fund_id: fundId,
        plan_name: newPlanName,
        selected_plans: defaults
      });

      // 3. Redirect to the new Inputs page
      router.push(`/fund-plan/${newPlan.id}/inputs`);
    } catch (e) {
      console.error("Failed to create plan", e);
      alert("Failed to create scenario.");
      setCreatingLoading(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this scenario? This cannot be undone.')) return;
    try {
      await api.deleteFundPlan(id);
      await loadData();
    } catch (e) {
      console.error('Failed to delete plan', e);
      alert('Failed to delete plan');
    }
  };

  const startEditing = (plan: FundPlan) => {
    setEditingPlanId(plan.id);
    setTempPlanName(plan.plan_name);
  };

  const cancelEditing = () => {
    setEditingPlanId(null);
    setTempPlanName('');
  };

  const savePlanName = async (id: string) => {
    if (!tempPlanName.trim()) return;
    const plan = plans.find(p => p.id === id);
    if (!plan) return;

    try {
      await api.updateFundPlan(id, {
        plan_name: tempPlanName,
        selected_plans: plan.selected_plans,
        pooling_fraction: plan.pooling_fraction
      });
      setEditingPlanId(null);
      await loadData();
    } catch (e) {
      console.error('Failed to rename plan', e);
      alert('Failed to rename plan');
    }
  };

  if (loading) return <Layout>Loading...</Layout>;
  if (!fund) return <Layout>Fund not found</Layout>;

  return (
    <Layout>
      {/* Breadcrumb Navigation */}
      <nav className='mb-6'>
        <Link 
          href='/' 
          className='text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium transition-colors'
        >
          <ArrowLeft className='h-4 w-4' />
          Back to Dashboard
        </Link>
      </nav>

      {/* Fund Header */}
      <div className="mb-10 border-b border-gray-200 pb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{fund.fund_name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide">
                {fund.currency_code}
              </span>
              <span className="text-sm text-gray-500">ID: {fund.id}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Fund Scenarios */}
      <section className="mb-12">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-500" />
              Fund Scenarios
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Manage simulation configurations and view Monte Carlo results.
            </p>
          </div>
          
          {!isCreating && (
            <button 
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Scenario
            </button>
          )}
        </div>

        {/* Creation Inline Form */}
        {isCreating && (
          <div className="mb-6 bg-white border border-indigo-200 rounded-lg p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Create New Scenario</h3>
            <div className="flex gap-3">
              <input 
                autoFocus
                type="text"
                placeholder="e.g., 'Q3 Stress Test' or 'Base Case 2025'"
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePlan()}
              />
              <button 
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreatePlan}
                disabled={!newPlanName.trim() || creatingLoading}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
              >
                {creatingLoading ? 'Creating...' : 'Create & Configure'}
              </button>
            </div>
          </div>
        )}

        {plans.length === 0 && !isCreating ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <BarChart3 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900">No Scenarios Defined</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              Create a simulation scenario to project fund performance.
            </p>
            <button 
              onClick={() => setIsCreating(true)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline"
            >
              Create First Scenario &rarr;
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map(plan => (
              <Card key={plan.id} className="flex flex-col justify-between h-full hover:shadow-md transition-shadow border-t-4 border-t-blue-500 group">
                <div className="mb-4">
                  <div className="flex justify-between items-start gap-2">
                    {editingPlanId === plan.id ? (
                      <div className="flex-1 flex items-center gap-1">
                        <input 
                          type="text" 
                          value={tempPlanName}
                          onChange={(e) => setTempPlanName(e.target.value)}
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') savePlanName(plan.id);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                        />
                        <button onClick={() => savePlanName(plan.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="h-4 w-4" /></button>
                        <button onClick={cancelEditing} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-lg font-bold text-gray-900 line-clamp-1 flex-1" title={plan.plan_name}>
                          {plan.plan_name}
                        </h3>
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEditing(plan)} className="p-1 text-gray-400 hover:text-blue-600 rounded" title="Rename"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => handleDeletePlan(plan.id)} className="p-1 text-gray-400 hover:text-red-600 rounded" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {editingPlanId !== plan.id && (
                    <>
                      <p className="text-xs text-gray-500 mt-1">
                        Created: {plan.created_at ? new Date(plan.created_at).toLocaleDateString() : 'Date N/A'}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <span className="bg-gray-100 px-2 py-1 rounded">
                          {Object.keys(plan.selected_plans || {}).length} Companies Linked
                        </span>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                  <Link 
                    href={`/fund-plan/${plan.id}/inputs`}
                    className="flex-1 flex items-center justify-center gap-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 py-2 rounded transition-colors border border-gray-200"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit Inputs
                  </Link>
                  <Link 
                    href={`/fund-plan/${plan.id}/results`}
                    className="flex-1 flex items-center justify-center gap-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 py-2 rounded transition-colors shadow-sm"
                  >
                    <Play className="h-3 w-3" />
                    Run / View
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Events */}
      <section className="mb-12">
        <EventList 
          fundId={fund?.id || null} 
          fundName={fund?.fund_name} 
          companies={companies} 
          funds={fund ? [fund] : []} 
        />
      </section>

      {/* Section 3: Portfolio Companies */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Portfolio Companies</h2>
            <p className="text-sm text-gray-500 mt-1">
              Entities managed under this fund.
            </p>
          </div>
          <Link 
            href="/structure#add-company"
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2 px-4 rounded-md transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Company
          </Link>
        </div>

        {companies.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <h3 className="text-sm font-medium text-gray-900">No Companies Yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Add your first portfolio company to start modeling.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map(co => (
              <Card key={co.id} className="h-full hover:border-blue-400 transition-colors group relative flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <Link href={`/company/${co.id}`} className="block flex-1 hover:text-blue-600 transition-colors">
                      <h3 className="text-lg font-bold text-gray-900">
                        {co.company_name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">{co.industry || 'General'}</p>
                    </Link>
                    <div className="flex items-center gap-2 ml-2">
                      <button 
                          onClick={(e) => { e.preventDefault(); handleDuplicateCompany(co.id); }}
                          title="Duplicate Company"
                          className="p-2 text-white bg-blue-500 hover:bg-blue-600 rounded shadow-sm transition-colors"
                      >
                          <Copy className="h-4 w-4" />
                      </button>
                      <button 
                          onClick={(e) => { e.preventDefault(); setMovingCompanyId(co.id); }}
                          title="Move Company"
                          className="p-2 text-white bg-gray-600 hover:bg-gray-700 rounded shadow-sm transition-colors"
                      >
                          <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                      {co.currency_code}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Move Company Modal */}
      {movingCompanyId && (
        <MoveCompanyModal 
          isOpen={!!movingCompanyId}
          onClose={() => setMovingCompanyId(null)}
          onSuccess={loadData}
          companyId={movingCompanyId}
          currentFundId={fundId}
        />
      )}
    </Layout>
  );
}
