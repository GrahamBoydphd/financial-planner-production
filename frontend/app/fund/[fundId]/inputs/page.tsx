'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit2, Plus, Save, X, ExternalLink, CheckCircle } from 'lucide-react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import { api, Fund, Company, FinancialPlan, FundPlan } from '@/lib/api';

export default function FundInputsPage({ params }: { params: { fundId: string } }) {
  const { fundId } = params;
  const router = useRouter();

  // --- Data State ---
  const [fund, setFund] = useState<Fund | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allPlans, setAllPlans] = useState<FinancialPlan[]>([]);
  const [fundPlans, setFundPlans] = useState<FundPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // --- UI State ---
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [isEditingSelection, setIsEditingSelection] = useState(false);
  const [draftSelections, setDraftSelections] = useState<Record<string, string>>({});
  
  // --- Creation State ---
  const [isCreating, setIsCreating] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState('');

  // 1. Initial Load
  const loadData = async () => {
    try {
      const [f, c, p, fp] = await Promise.all([
        api.getFund(fundId),
        api.getCompanies(),
        api.getPlans(),
        api.getFundPlans(fundId)
      ]);
      setFund(f);
      // Filter companies belonging to this fund
      const fundCompanies = c.filter(comp => comp.fund_id === fundId);
      setCompanies(fundCompanies);
      setAllPlans(p);
      setFundPlans(fp);

      // Default: Select first scenario if available and none selected
      if (!activeScenarioId && fp.length > 0) {
        selectScenario(fp[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fundId]);

  // 2. Logic: Select a Scenario
  const selectScenario = (fp: FundPlan) => {
    setActiveScenarioId(fp.id);
    setDraftSelections(fp.selected_plans || {});
    setIsEditingSelection(false);
  };

  // 3. Logic: Create Scenario
  const handleCreate = async () => {
    if (!newScenarioName.trim()) return;
    try {
      // Default selection: Most recent plan for each company
      const defaults: Record<string, string> = {};
      companies.forEach(c => {
        const cPlans = allPlans.filter(p => p.company_id === c.id);
        // Sort by ID assuming simpler IDs are older, or just take last found
        if (cPlans.length > 0) defaults[c.id] = cPlans[cPlans.length - 1].id;
      });

      await api.createFundPlan({
        fund_id: fundId,
        plan_name: newScenarioName,
        selected_plans: defaults
      });
      
      setNewScenarioName('');
      setIsCreating(false);
      loadData(); // Reload to get new ID
    } catch (e) {
      console.error("Create failed", e);
    }
  };

  // 4. Logic: Save Selections
  const handleSaveSelections = async () => {
    if (!activeScenarioId) return;
    
    // Validate: All companies must have a selection
    // Note: If a company has NO plans at all, we can't select one. 
    // Ideally we should warn, but let's just proceed with what we have.
    
    try {
      const current = fundPlans.find(fp => fp.id === activeScenarioId);
      if (!current) return;

      await api.updateFundPlan(activeScenarioId, {
        plan_name: current.plan_name,
        selected_plans: draftSelections
      });
      
      setIsEditingSelection(false);
      loadData();
    } catch (e) {
      console.error("Save failed", e);
    }
  };

  // 5. Logic: Run Simulation
  const handleRun = () => {
    if (!activeScenarioId) return;
    router.push(`/fund/${fundId}/results?fund_plan_id=${activeScenarioId}`);
  };

  if (loading) return <Layout>Loading...</Layout>;
  if (!fund) return <Layout>Fund not found</Layout>;

  return (
    <Layout>
       <nav className='mb-6'>
        <Link href='/' className='text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium transition-colors'>
          <ArrowLeft className='h-4 w-4' />
          Back to Dashboard
        </Link>
      </nav>

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{fund.fund_name} <span className="text-gray-400 font-normal">Scenarios</span></h1>
          <p className="text-gray-500 text-sm">Configure different portfolio compositions (e.g., Base Case vs. Stress Test).</p>
        </div>
        <button 
          onClick={handleRun}
          disabled={!activeScenarioId || isEditingSelection}
          className={`px-6 py-2 rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2
            ${(!activeScenarioId || isEditingSelection) 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
        >
          Run Simulation &rarr;
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-200px)]">
        
        {/* LEFT COL: SCENARIO LIST */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <Card className="flex-1 flex flex-col p-0 overflow-hidden bg-gray-50 border-gray-200">
            <div className="p-4 border-b bg-white flex justify-between items-center sticky top-0">
              <h3 className="font-bold text-gray-700">Saved Scenarios</h3>
              <button 
                onClick={() => setIsCreating(true)}
                className="text-indigo-600 hover:bg-indigo-50 p-1 rounded"
                title="New Scenario"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {isCreating && (
                <div className="bg-white p-3 rounded border border-indigo-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <input 
                    autoFocus
                    placeholder="Scenario Name..." 
                    className="w-full border-b border-gray-300 focus:border-indigo-500 outline-none text-sm font-medium mb-2"
                    value={newScenarioName}
                    onChange={e => setNewScenarioName(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setIsCreating(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                    <button onClick={handleCreate} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">Create</button>
                  </div>
                </div>
              )}

              {fundPlans.length === 0 && !isCreating && (
                <p className="text-center text-sm text-gray-400 py-8 italic">No scenarios yet.</p>
              )}

              {fundPlans.map(fp => (
                <div 
                  key={fp.id}
                  onClick={() => selectScenario(fp)}
                  className={`p-3 rounded cursor-pointer border transition-all group ${
                    activeScenarioId === fp.id 
                      ? 'bg-white border-indigo-500 shadow-sm ring-1 ring-indigo-500' 
                      : 'bg-white border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`font-medium text-sm ${activeScenarioId === fp.id ? 'text-indigo-900' : 'text-gray-700'}`}>
                      {fp.plan_name}
                    </span>
                    {activeScenarioId === fp.id && (
                       <CheckCircle size={14} className="text-indigo-600" />
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 flex justify-between">
                     <span>{Object.keys(fp.selected_plans || {}).length} / {companies.length} Linked</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* RIGHT COL: MATRIX */}
        <div className="lg:col-span-8 flex flex-col h-full">
           {activeScenarioId ? (
             <Card className="h-full flex flex-col p-0 overflow-hidden border-t-4 border-indigo-500">
                {/* TOOLBAR */}
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                   <h3 className="font-bold text-gray-800">Composition Matrix</h3>
                   
                   {!isEditingSelection ? (
                     <button 
                       onClick={() => setIsEditingSelection(true)}
                       className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600 bg-white border px-3 py-1 rounded shadow-sm"
                     >
                       <Edit2 size={14} /> Edit Choices
                     </button>
                   ) : (
                     <div className="flex gap-2">
                        <button 
                          onClick={() => {
                             // Revert
                             const current = fundPlans.find(fp => fp.id === activeScenarioId);
                             setDraftSelections(current?.selected_plans || {});
                             setIsEditingSelection(false);
                          }}
                          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 px-3 py-1"
                        >
                          <X size={14} /> Cancel
                        </button>
                        <button 
                          onClick={handleSaveSelections}
                          className="flex items-center gap-1 text-sm bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 shadow-sm"
                        >
                          <Save size={14} /> Save Changes
                        </button>
                     </div>
                   )}
                </div>

                {/* LIST */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                  {companies.map(co => {
                     const coPlans = allPlans.filter(p => p.company_id === co.id);
                     const selectedId = draftSelections[co.id];
                     const selectedPlan = coPlans.find(p => p.id === selectedId);

                     return (
                       <div key={co.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                          <div className="flex justify-between items-start mb-3">
                             <div className="flex items-center gap-2">
                                <h4 className="font-bold text-gray-800">{co.company_name}</h4>
                                <Link href={`/company/${co.id}`} target="_blank" className="text-gray-400 hover:text-blue-600">
                                   <ExternalLink size={12} />
                                </Link>
                             </div>
                             {selectedPlan && !isEditingSelection && (
                               <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-medium">
                                 {selectedPlan.plan_name}
                               </span>
                             )}
                             {!selectedPlan && (
                               <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-medium">
                                 Not Selected
                               </span>
                             )}
                          </div>

                          {/* EDIT MODE: RADIO LIST */}
                          {isEditingSelection ? (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                {coPlans.length === 0 && <span className="text-xs text-gray-400 italic">No plans available.</span>}
                                {coPlans.map(p => (
                                  <label 
                                    key={p.id}
                                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                                       selectedId === p.id 
                                       ? 'bg-indigo-50 border-indigo-500 text-indigo-900' 
                                       : 'border-gray-100 hover:bg-gray-50'
                                    }`}
                                  >
                                     <input 
                                       type="radio" 
                                       name={`plan-${co.id}`}
                                       checked={selectedId === p.id}
                                       onChange={() => setDraftSelections(prev => ({ ...prev, [co.id]: p.id }))}
                                       className="text-indigo-600 focus:ring-indigo-500"
                                     />
                                     <div className="flex flex-col">
                                        <span className="text-sm font-medium">{p.plan_name}</span>
                                        <span className="text-[10px] text-gray-500">Starts {p.start_month}</span>
                                     </div>
                                  </label>
                                ))}
                             </div>
                          ) : (
                             // VIEW MODE: SUMMARY
                             <div className="text-sm text-gray-600">
                                {selectedPlan 
                                  ? <span className="text-gray-500">Simulation will use <span className="font-semibold text-gray-900">{selectedPlan.plan_name}</span>.</span>
                                  : <span className="text-red-500 font-medium">No plan selected. Edit choices to fix.</span>
                                }
                             </div>
                          )}
                       </div>
                     );
                  })}
                </div>
             </Card>
           ) : (
             <div className="h-full flex items-center justify-center text-gray-400 bg-gray-50 border border-dashed rounded-lg">
                <div className="text-center">
                  <p className="mb-2">Select a scenario from the left to configure.</p>
                  <p className="text-xs">Or create a new one.</p>
                </div>
             </div>
           )}
        </div>

      </div>
    </Layout>
  );
}
