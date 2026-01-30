🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
<file path='frontend/app/company/[companyId]/page.tsx'>
'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import { api, Company, FinancialPlan, Fund } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, Copy, Loader2, Trash2, Edit2, Check, X } from 'lucide-react';

export default function CompanyPage({ params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const [company, setCompany] = useState<Company | null>(null);
  const [fund, setFund] = useState<Fund | null>(null);
  const [plans, setPlans] = useState<FinancialPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Plan State
  const [isCreating, setIsCreating] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [startMonth, setStartMonth] = useState(new Date().toISOString().slice(0, 7) + '-01'); // YYYY-MM-01

  // Duplication State
  const [duplicatingPlanId, setDuplicatingPlanId] = useState<string | null>(null);

  // Editing State
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [tempPlanName, setTempPlanName] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const c = await api.getCompany(companyId);
      setCompany(c);

      // Fetch Fund for breadcrumb
      if (c.fund_id) {
        const f = await api.getFund(c.fund_id);
        setFund(f);
      }

      // Fetch all plans and filter (Optimization: Add backend filter later)
      const allPlans = await api.getPlans();
      setPlans(allPlans.filter(p => p.company_id === companyId));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  const handleCreatePlan = async () => {
    if (!newPlanName || !startMonth || !company) return;
    try {
        await api.createPlan(companyId, newPlanName, startMonth, company.currency_code);
        setNewPlanName('');
        setIsCreating(false);
        loadData();
    } catch (e) {
        alert("Error creating plan. Ensure date is YYYY-MM-DD");
    }
  };

  const handleDuplicatePlan = async (id: string) => {
    if(!confirm('Duplicate this scenario?')) return;
    try {
        setDuplicatingPlanId(id);
        await api.duplicatePlan(id);
        setDuplicatingPlanId(null);
        await loadData();
    } catch(e) {
        console.error(e);
        alert('Failed to duplicate plan');
        setDuplicatingPlanId(null);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scenario? This cannot be undone.')) return;
    try {
      await api.deletePlan(id);
      await loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to delete plan');
    }
  };

  const handleUpdatePlanName = async () => {
    if (!editingPlanId || !tempPlanName.trim()) return;
    try {
        // @ts-ignore
        await api.updatePlan(editingPlanId, { plan_name: tempPlanName });
        setEditingPlanId(null);
        setTempPlanName("");
        await loadData();
    } catch (e) {
        console.error(e);
        alert('Failed to update plan name');
    }
  };

  if (loading) return <Layout>Loading...</Layout>;
  if (!company) return <Layout>Company not found</Layout>;

  return (
    <Layout>
      <nav className='mb-6'>
        <Link href='/' className='text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium transition-colors'>
          <ArrowLeft className='h-4 w-4' />
          Back to Dashboard
        </Link>
      </nav>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:underline">Dashboard</Link>
        <span>/</span>
        {fund && <Link href={`/fund/${fund.id}`} className="hover:underline">{fund.fund_name}</Link>}
        {fund && <span>/</span>}
        <span>{company.company_name}</span>
      </div>

      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">{company.company_name} [{company.currency_code}]</h1>
            <p className="text-gray-500">{company.industry} • {company.business_model || 'Business Model'}</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 font-medium"
        >
          + New Scenario
        </button>
      </div>

      {isCreating && (
        <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded animate-fade-in">
            <h3 className="font-bold text-teal-800 mb-2">Create Financial Scenario</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input 
                    className="border p-2 rounded" 
                    placeholder="Scenario Name (e.g. Base Case)" 
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                />
                <input 
                    type="date"
                    className="border p-2 rounded" 
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                />
                <div className="flex gap-2">
                    <button onClick={handleCreatePlan} className="bg-teal-600 text-white px-4 py-2 rounded font-bold w-full">Start Planning</button>
                    <button onClick={() => setIsCreating(false)} className="text-gray-500 px-4 py-2">Cancel</button>
                </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">Select the simulation start date.</p>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded border border-dashed">
            <h3 className="text-lg font-bold text-gray-600">No Financial Plans</h3>
            <p className="text-gray-400 mb-4">Create a "Base Case" to start modeling revenue and costs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map(plan => (
                <Card key={plan.id} className="hover:shadow-lg transition-shadow border-l-4 border-teal-500 h-full flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start">
                            {editingPlanId === plan.id ? (
                                <div className="flex items-center gap-1 flex-grow mr-2">
                                    <input 
                                        className="border border-gray-300 p-1 rounded text-sm font-bold text-gray-800 w-full"
                                        value={tempPlanName}
                                        onChange={(e) => setTempPlanName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleUpdatePlanName();
                                            if (e.key === 'Escape') setEditingPlanId(null);
                                        }}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <button onClick={handleUpdatePlanName} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                        <Check className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => setEditingPlanId(null)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <h2 className="text-xl font-bold text-gray-800 truncate" title={plan.plan_name}>{plan.plan_name}</h2>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingPlanId(plan.id);
                                            setTempPlanName(plan.plan_name);
                                        }}
                                        className="text-gray-300 hover:text-blue-600 transition-colors p-1 flex-shrink-0"
                                        title="Rename Scenario"
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                </div>
                            )}

                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button 
                                    onClick={() => handleDuplicatePlan(plan.id)}
                                    title="Duplicate Scenario"
                                    disabled={duplicatingPlanId === plan.id}
                                    className="text-gray-400 hover:text-teal-600 transition-colors p-1 disabled:cursor-not-allowed"
                                >
                                    {duplicatingPlanId === plan.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </button>
                                <button
                                    onClick={() => handleDeletePlan(plan.id)}
                                    title="Delete Scenario"
                                    className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Starts: {plan.start_month}</p>
                    </div>
                    
                    <div className="mt-6 flex justify-between items-center gap-2">
                        <Link 
                            href={`/plan/${plan.id}/inputs`}
                            className="text-sm font-bold text-blue-600 hover:bg-blue-50 px-3 py-1 rounded"
                        >
                            Edit Inputs
                        </Link>
                        <Link 
                            href={`/plan/${plan.id}/results`}
                            className="text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 px-3 py-1 rounded"
                        >
                            View Results &rarr;
                        </Link>
                    </div>
                </Card>
            ))}
        </div>
      )}
    </Layout>
  );
}
</file>

