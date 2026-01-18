'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import CashFlowChart from '@/components/CashFlowChart';
import Button from '@/components/ui/Button';
import { api, FinancialPlan, CapitalInjection, DividendPolicy, CreditFacility, Company } from '@/lib/api';

// --- COMPONENT: KPI CARDS ---
interface KPIProps {
  simMode: string;
  projection: any;
  creditLimit: string;
  stopInsolvency: boolean;
  currency: string;
  valuationMethod: string;
}

const KPICards = ({ simMode, projection, creditLimit, stopInsolvency, currency, valuationMethod }: KPIProps) => {
    if (!projection) return null;

    // Helper to format with currency
    const fmt = (n: any) => 
        `${currency} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    const lastData = projection.deterministic_data?.[projection.deterministic_data.length - 1] || {};
    const singleLastData = projection.single_run_data?.[projection.single_run_data.length - 1] || lastData;

    let totalVal = lastData.total_value;
    let valuation = projection.deterministic_valuation;
    let subtitle = 'Deterministic Average';
    let insolvencyMonth = -1;
    let runwayVal: number | string = 'Infinite';

    const checkInsolvency = (dataArray: any[]) => {
        if (!dataArray) return -1;
        // Check for explicit flag (is_solvent = false) or calculation
        const idx = dataArray.findIndex(m => 
            (m.is_solvent === false) || 
            (m.is_insolvent === true) || 
            Number(m.cash_balance) < -(Number(creditLimit) || 0)
        );
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
        
        // Fix P50 Runway Logic: Check if last month is insolvent or cash <= 0
        const lastP50 = projection.p50_data?.[projection.p50_data.length - 1];
        const isP50Insolvent = lastP50 && (
            lastP50.is_solvent === false || 
            Number(lastP50.cash_balance) <= 0
        );

        const backendRunway = projection.p50_runway ?? 'Infinite';

        if (isP50Insolvent) {
            // Regression Test: Check if the company is insolvent BUT 'proj.p50_runway' > 0
            if (backendRunway !== 'Infinite' && Number(backendRunway) > 0) {
                console.warn('Backend Data Mismatch: Insolvent P50 run has positive runway');
            }
            // Strictly show '0 Mo' if insolvent, ignoring positive backend value
            runwayVal = 0;
        } else {
            runwayVal = backendRunway;
        }
        
    } else {
        // Standard
        insolvencyMonth = checkInsolvency(projection.deterministic_data);
        runwayVal = calculateRunway(Number(lastData.cash_balance), Number(lastData.net_income));
    }

    const p90Val = projection.p90_value?.[projection.p90_value.length - 1] || 0;

    // --- NEW LOGIC: Risk & Variance ---
    const survivalRate = projection.survival_rate?.[projection.survival_rate.length - 1] ?? 0;
    const finalSurvival = survivalRate * 100;
    
    const p50Cash = projection.p50_data?.[projection.p50_data.length - 1]?.cash_balance ?? 0;
    const detCash = projection.deterministic_data?.[projection.deterministic_data.length - 1]?.cash_balance ?? 0;
    const cashDelta = Number(p50Cash) - Number(detCash);

    return (
      <>
        {simMode === 'monte_carlo' && (
            <Card className="text-center border-b-4 border-orange-500 mb-4">
                <h3 className="text-orange-700 text-xs uppercase font-bold">Risk & Variance</h3>
                <div className="mt-2 mb-2">
                    <p className="text-xs text-gray-500">Probability of Survival</p>
                    <p className={`text-xl font-bold ${finalSurvival < 50 ? 'text-red-600' : 'text-green-600'}`}>
                        {finalSurvival.toFixed(1)}%
                    </p>
                </div>
                <div className="border-t pt-2">
                    <p className="text-xs text-gray-500">Cash Delta vs. Conventional</p>
                    <p className={`text-lg font-bold ${cashDelta < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {cashDelta > 0 ? '+' : ''}{fmt(cashDelta)}
                    </p>
                </div>
            </Card>
        )}

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
            <h3 className="text-gray-500 text-sm uppercase">
                {simMode === 'monte_carlo' ? 'Valuation (EST) of middle (P50 median)' : 'Valuation (Est)'}
            </h3>
            <p className="text-2xl font-bold text-green-600">{fmt(valuation)}</p>
            <p className="text-xs text-gray-400 mt-1">
                {valuationMethod === 'ebitda' ? 'Based on EBITDA' : 'Based on Final Revenue'}
            </p>
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
  const [company, setCompany] = useState<Company | null>(null);
  const [projection, setProjection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingPooling, setUpdatingPooling] = useState(false);
  const [error, setError] = useState<string | null>(null);
   
  // Financial State
  const [capitalItems, setCapitalItems] = useState<CapitalInjection[]>([]);
  const [initialCash, setInitialCash] = useState("0");
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

  const [valuationMethod, setValuationMethod] = useState('revenue');

  // Controls
  const [years, setYears] = useState(5);
  const [isLogScale, setIsLogScale] = useState(true); // Default Log Scale
  const [simMode, setSimMode] = useState<'single' | 'monte_carlo' | 'standard'>('standard');
  const [stopInsolvency, setStopInsolvency] = useState(true); // Default to TRUE
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Non-Ergodicity State
  const [poolingFraction, setPoolingFraction] = useState(0);
  
  // UI Settings
  const [currency, setCurrency] = useState('USD'); // Default USD

  // --- DATA LOADING ---
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const p = await api.getPlan(planId);
        setPlan(p);

        if (p.company_id) {
            try {
                const c = await api.getCompany(p.company_id);
                setCompany(c);
            } catch (e) {
                console.error("Failed to fetch company", e);
            }
        }

        setInitialCash(p.initial_cash || "0");
        // Sync slider with DB state on reload
        setPoolingFraction(Number(p.pooling_fraction || 0) * 100);
        
        // Set currency from plan
        setCurrency(p.currency_code || 'USD');
        
        const caps = await api.getCapitalInjections(planId);
        setCapitalItems(caps);
        
        try {
          const div = await api.getDividends(planId);
          setDividendPolicy(div);
          setDivEnabled(div.is_enabled);
          setDivThreshold(div.safety_threshold.toString());
          // Convert decimal (0.2) to percentage (20) for display, rounded to avoid artifacts
          setDivRatio((Number(div.payout_ratio) * 100).toFixed(0));
        } catch (e: any) {
            if (e.response && e.response.status === 404) {
                setDividendPolicy(null);
                setDivEnabled(false);
                setDivThreshold('50000');
                setDivRatio('20');
            } else {
                console.error("Failed to fetch dividends", e);
            }
        }

        try {
          const cred = await api.getCredit(planId);
          setCreditFacility(cred);
          setCreditLimit(cred.facility_limit.toString());
          // Round to avoid floating point artifacts in input
          setCreditRate(Number(cred.interest_rate).toFixed(0));
          setCreditIsAnnual(cred.is_annual_rate);
        } catch (e: any) {
            if (e.response && e.response.status === 404) {
                setCreditFacility(null);
                setCreditLimit('0');
                setCreditRate('10');
                setCreditIsAnnual(true);
            } else {
                console.error("Failed to fetch credit", e);
            }
        }

        try {
          const vals = await api.getValuation(planId);
          if (vals && vals.length > 0) {
             const latest = vals[vals.length - 1];
             setValuationMethod(latest.method);
          }
        } catch (e: any) {
            if (e.response && e.response.status === 404) {
                setValuationMethod('revenue');
            } else {
                console.error("Failed to fetch valuation", e);
            }
        }

        // Use standard or monte_carlo depending on UI
        const backendMode = simMode === 'monte_carlo' ? 'monte_carlo' : 'single';
        const proj = await api.getProjection(planId, {
           mode: backendMode,
           stop_insolvency: stopInsolvency,
           initial_cash: Number(p.initial_cash || 0),
           months: years * 12 // FIX: Pass months based on years selector
        });

        if (proj.valuation_method) {
            setValuationMethod(proj.valuation_method);
        }
        
        // --- DATA MAPPING FOR TABLE ---
        let sourceData = proj.deterministic_data;
        
        if (simMode === 'monte_carlo' && proj.p50_data) {
            sourceData = proj.p50_data;
        } else if (simMode === 'single' && proj.single_run_data) {
            sourceData = proj.single_run_data;
        }

        const tableData = sourceData.map((m: any) => {
           return {
               month_index: m.month_index,
               date: m.date,
               revenue: m.revenue,
               cogs: m.cogs,
               gross_profit: m.gross_profit,
               opex: m.opex,
               net_income: m.net_income,
               cumulative_pool_received: m.cumulative_pool_received,
               cash_balance: m.cash_balance,
               total_value: m.total_value,
               dividend_paid: m.dividend_paid,
               is_solvent: m.is_solvent
           };
        });
        
        (proj as any).cash_flow_data = tableData;
        setProjection(proj);

      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
        setUpdatingPooling(false);
      }
    };
    load();
  }, [planId, years, simMode, stopInsolvency, refreshTrigger]); 

  // --- 3. HANDLERS ---
  const handleAddCapital = async () => {
    if (!newCapName || !newCapAmount) return;
    await api.createCapitalInjection({
      plan_id: planId,
      name: newCapName,
      amount: parseFloat(newCapAmount).toFixed(2),
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
      safety_threshold: divThreshold,
      payout_ratio: (Number(divRatio) / 100).toString()
    });
    setRefreshTrigger(n => n + 1);
  };

  const handleSaveCredit = async () => {
    await api.upsertCredit({
      plan_id: planId,
      facility_limit: creditLimit,
      interest_rate: creditRate,
      is_annual_rate: creditIsAnnual
    });
    setRefreshTrigger(n => n + 1);
  };

  const handlePoolingSave = async () => {
    if (!plan) return;
    setUpdatingPooling(true);
    try {
        // Strictly await the update before triggering refresh
        const pf = Number(poolingFraction);
        await api.updatePlan(planId, { pooling_fraction: (pf / 100.0).toString() });
        
        // Trigger refresh, set loading to true to bridge gap until useEffect runs
        setLoading(true);
        setRefreshTrigger(n => n + 1);
    } catch (e) {
        console.error("Failed to update pooling fraction", e);
        setUpdatingPooling(false);
        setLoading(false);
    }
  };

  // Helper
  const fmt = (n: any) => 
    `${currency} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  if (!plan) return <Layout>Loading...</Layout>;

  return (
    <Layout>
      <nav className='mb-6'>
        <Link href={`/company/${plan.company_id}`} className='text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium transition-colors'>
          <ArrowLeft className='h-4 w-4' />
          Return to Company
        </Link>
      </nav>

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plan {plan.plan_name} <span className="text-gray-500 font-normal">for {company?.company_name}</span> - Projections</h1>
          <p className="text-gray-500">Financial Simulation Engine v2.0</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
            <div className="bg-white p-2 rounded shadow flex flex-wrap items-center gap-4">
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
                  <option value="monte_carlo">Likely real-world outcomes (1000 Runs)</option>
                </select>
              </div>

              {/* Currency Badge */}
              <div className="flex items-center gap-2 border-l pl-4">
                  <span className="text-xs text-gray-500">Currency:</span>
                  <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded text-gray-700 border">
                      {plan.currency_code || 'USD'}
                  </span>
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

              {/* Non-Ergodicity Slider */}
              {simMode === 'monte_carlo' && (
                <div className="flex flex-col justify-center border-l pl-4 w-40">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider cursor-help" title="Strength of the correction factor for non-ergodicity. Higher values pool more profit to smooth volatility across trajectories.">Ergodicity Correction</span>
                        {updatingPooling ? (
                            <span className="text-xs font-bold text-gray-400 animate-pulse">Updating...</span>
                        ) : (
                            <span className="text-xs font-bold text-blue-600">{Math.round(poolingFraction)}%</span>
                        )}
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      step="1"
                      value={poolingFraction}
                      onChange={(e) => setPoolingFraction(Number(e.target.value))}
                      onMouseUp={handlePoolingSave}
                      onTouchEnd={handlePoolingSave}
                      disabled={updatingPooling || loading}
                      className={`w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer ${updatingPooling || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {simMode === 'single' && (
                 <Button variant="secondary" onClick={() => setRefreshTrigger(n => n + 1)}>Recalculate 🎲</Button>
              )}
              <a href={`/plan/${planId}/inputs`} className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 font-medium">Edit Revenue/Cost</a>
            </div>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded mb-4 border border-red-200">Simulation Error: {error}</div>}

      {loading ? (
        <div className="text-center py-20 animate-pulse text-blue-600 font-medium">Running Simulation...</div>
      ) : projection && (projection.deterministic_data?.length > 0 || projection.single_run_data?.length > 0) ? (
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
                    currencySymbol={`${currency} `}
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
                    currencySymbol={`${currency} `}
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
                      currencySymbol={`${currency} `}
                    />
                  </div>
                </Card>
              </div>
              <div className="w-full lg:w-64 flex-shrink-0">
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                   <KPICards simMode={simMode} projection={projection} creditLimit={creditLimit} stopInsolvency={stopInsolvency} currency={currency} valuationMethod={valuationMethod} />
                </div>
              </div>
            </div>
          )}

          {simMode === 'single' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <KPICards simMode={simMode} projection={projection} creditLimit={creditLimit} stopInsolvency={stopInsolvency} currency={currency} valuationMethod={valuationMethod} />
            </div>
          )}

          {/* --- INLINED GRID TO FIX FOCUS LOSS --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <Card>
              <h3 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">Capital Stack</h3>
              
              <div className="bg-green-50 border border-green-200 text-green-800 p-2 rounded mb-4 text-sm flex justify-between items-center">
                <span className="font-medium">Opening Balance (Day 0):</span>
                <span className="font-bold">{fmt(initialCash)}</span>
              </div>

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
                <input type="number" placeholder={currency} className="border p-1 text-xs rounded" 
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
                  <label className="text-xs text-gray-500 block">Safety Threshold ({currency})</label>
                  <input type="number" className="border p-1 w-full text-sm rounded" 
                    value={divThreshold} onChange={e => setDivThreshold(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block">Payout Ratio ({Math.round(Number(divRatio))}%)</label>
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
                  <label className="text-xs text-gray-500 block">Limit ({currency})</label>
                  <input type="number" className="border p-1 w-full text-sm rounded" 
                    value={creditLimit} onChange={e => setCreditLimit(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block">Rate ({Math.round(Number(creditRate))}%)</label>
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
            <h3 className="text-lg font-bold text-gray-700 mb-4 px-4 pt-4">Most typical (median) outcome</h3>
            <table className="min-w-full text-xs text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Revenue</th>
                  <th className="px-4 py-3">Gross Profit</th>
                  <th className="px-4 py-3">OpEx</th>
                  <th className="px-4 py-3">Net Income</th>
                  <th className="px-4 py-3 text-orange-600">Pool Received</th>
                  <th className="px-4 py-3 text-gray-900 font-bold">Cash Bal</th>
                  <th className="px-4 py-3 text-green-600">Dividends</th>
                  <th className="px-4 py-3 text-blue-700 font-bold">Net Value</th>
                </tr>
              </thead>
              <tbody>
                {(projection as any).cash_flow_data.map((row: any) => {
                  const isRowInsolvent = !row.is_solvent;
                  return (
                  <tr key={row.month_index} className={`border-b ${isRowInsolvent ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50 bg-white'}`}>
                    <td className="px-4 py-2 font-medium">{row.month_index}</td>
                    <td className="px-4 py-2">{fmt(row.revenue)}</td>
                    <td className="px-4 py-2">{fmt(row.gross_profit)}</td>
                    <td className="px-4 py-2">{fmt(row.opex)}</td>
                    <td className={`px-4 py-2 ${isRowInsolvent ? '' : (row.net_income < 0 ? 'text-red-500' : 'text-green-600')}`}>{fmt(row.net_income)}</td>
                    <td className={`px-4 py-2 ${isRowInsolvent ? '' : 'text-orange-600'}`}>{fmt(row.cumulative_pool_received)}</td>
                    <td className={`px-4 py-2 font-bold ${isRowInsolvent ? '' : (row.cash_balance < 0 ? 'text-red-600' : 'text-gray-900')}`}>{fmt(row.cash_balance)}</td>
                    <td className={`px-4 py-2 ${isRowInsolvent ? '' : 'text-green-600'}`}>{row.dividend_paid > 0 ? fmt(row.dividend_paid) : '-'}</td>
                    <td className={`px-4 py-2 font-bold ${isRowInsolvent ? '' : (row.total_value < 0 ? 'text-red-600' : 'text-blue-700')}`}>
                      {fmt(row.total_value)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded border-2 border-dashed border-gray-300">
            <p className="text-xl font-bold text-gray-400 mb-2">No Data Available</p>
            <p className="text-gray-500">Enter Revenue / Cost / Capital items first</p>
            <a href={`/plan/${planId}/inputs`} className="mt-4 text-blue-600 hover:underline">Go to Inputs</a>
        </div>
      )}
    </Layout>
  );
}
