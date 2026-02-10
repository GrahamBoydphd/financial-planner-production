'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import { api, Fund, SimulationResult } from '@/lib/api';
import FundChart, { FanData } from '@/components/FundChart';
import FundKPICards from '@/components/display/FundKPICards';

const YEAR_OPTIONS = [1, 2, 3, 5, 10, 20, 50, 100];

type ViewMode = 'standard' | 'single' | 'monte_carlo';

// Helper to extract FanData from SimulationResult
const extractFanData = (sim: SimulationResult): FanData => {
  const parse = (arr?: (number | string)[]) => arr?.map(v => Number(v));

  return {
    p0: parse(sim.p0_value),
    p5: parse(sim.p5_value),
    p10: parse(sim.p10_value),
    p25: parse(sim.p25_value),
    p50: parse(sim.p50_value),
    p75: parse(sim.p75_value),
    p90: parse(sim.p90_value),
    p95: parse(sim.p95_value),
    p100: parse(sim.p100_value),
    
    // Solvency Wiring
    p0_solvent_count: parse(sim.p0_solvent_count),
    p10_solvent_count: parse(sim.p10_solvent_count),
    p25_solvent_count: parse(sim.p25_solvent_count),
    p50_solvent_count: parse(sim.p50_solvent_count),
    p75_solvent_count: parse(sim.p75_solvent_count),
    p90_solvent_count: parse(sim.p90_solvent_count),
    p100_solvent_count: parse(sim.p100_solvent_count),
    p50_data: sim.p50_data,
  } as any;
};

export default function FundResultsPage({ params }: { params: { fundId: string } }) {
  const { fundId } = params;
  const searchParams = useSearchParams();
  const fundPlanId = searchParams.get('fund_plan_id');
  
  // Data State
  const [fund, setFund] = useState<Fund | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [simLoading, setSimLoading] = useState(false);

  // Control State
  const [isLogScale, setIsLogScale] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [poolingFraction, setPoolingFraction] = useState<number>(0);
  const [years, setYears] = useState<number>(5);
  const [stopInsolvency, setStopInsolvency] = useState<boolean>(true);
  const [eventsActive, setEventsActive] = useState<boolean>(true);
  
  // Investor Track State
  const [targetMultiple, setTargetMultiple] = useState<number>(3.0);
  const [includeInitialCapital, setIncludeInitialCapital] = useState<boolean>(false);
  
  // Path Exploration State
  const [pathIndex, setPathIndex] = useState<number>(0);

  // 1. Initial Load (Fund Metadata)
  useEffect(() => {
    const load = async () => {
      try {
        const f = await api.getFund(fundId);
        setFund(f);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fundId]);

  // 2. Simulation Load
  const loadSim = useCallback(async () => {
    if (!fund) return;
    
    try {
      setSimLoading(true);
      
      const months = years * 12;
      const simParams = {
          fund_plan_id: fundPlanId || undefined,
          months: months,
          fund_pooling_fraction: poolingFraction.toFixed(1),
          stop_insolvency: stopInsolvency,
          include_initial_capital: includeInitialCapital,
          events_active: eventsActive,
      };

      // Single API call for all data
      const res = await api.getFundSimulation(fundId, simParams);
      setSimulation(res);
      setPathIndex(0); // Reset path index on new simulation

    } catch (e) {
      console.error("Simulation failed", e);
    } finally {
      setSimLoading(false);
    }
  }, [fund, fundId, fundPlanId, poolingFraction, years, stopInsolvency, includeInitialCapital, eventsActive]);

  // Trigger simulation on dependency change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
        loadSim();
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [loadSim]);

  // --- DATA PREPARATION ---

  // 1. Deterministic Data (Standard Mode)
  const detRows = simulation?.deterministic_data || [];
  
  // Check for empty data
  if (simulation && detRows.length === 0) {
      console.warn('No Deterministic Data Available');
  }

  const deterministicValues = detRows.map((d: any) => Number(d.total_value || 0));
  // NEW: Deterministic Investment (Exposure)
  const deterministicInvestment = detRows.map((d: any) => Number(d.total_exposure || d.cumulative_external_capital || 0));

  // 2. Single Path Data (Volatile Mode)
  const allPathsRaw = simulation?.all_paths;
  
  // Memoize Values
  const allPaths = useMemo(() => 
    Array.isArray(allPathsRaw) 
      ? allPathsRaw.map((p: any[]) => p.map((v: any) => {
          // FIX: Handle object structure from backend (Fortress Standard)
          if (typeof v === 'object' && v !== null) {
              return Number(v.total_value);
          }
          return Number(v);
      })) 
      : [], 
  [allPathsRaw]);

  // NEW: Memoize Investment/Exposure Paths
  const allPathsInvestment = useMemo(() => 
    Array.isArray(allPathsRaw) 
      ? allPathsRaw.map((p: any[]) => p.map((v: any, idx: number) => {
          if (typeof v === 'object' && v !== null) {
              return Number(v.total_exposure || v.cumulative_external_capital || 0);
          }
          // Fallback to deterministic if scalar (legacy support)
          return deterministicInvestment[idx] || 0;
      })) 
      : [], 
  [allPathsRaw, deterministicInvestment]);
    
  const singlePathValues = allPaths.length > 0 && allPaths[pathIndex] ? allPaths[pathIndex] : [];
  const singlePathInvestment = allPathsInvestment.length > 0 && allPathsInvestment[pathIndex] ? allPathsInvestment[pathIndex] : [];
  
  // Prepare current path values for KPI Cards
  const currentPathValues = viewMode === 'single' && singlePathValues.length > 0 ? {
      netValue: singlePathValues[singlePathValues.length - 1],
  } : undefined;

  // 3. Investor Track Math (Likelihood & DPI)
  const p50Data = simulation?.p50_data || [];
  
  const { likelihoodData, dpiData } = useMemo(() => {
    if (!simulation || !p50Data.length) return { likelihoodData: [], dpiData: [] };

    // Calculate Likelihood Array (Probability > Target Multiple)
    const likelihood = p50Data.map((monthData, idx) => {
        // FIX: Force Month 0 to 0% to avoid "100% success" artifact when investment is 0
        if (idx === 0) return 0;

        if (!allPaths.length) return 0;
        
        const investment = Number(monthData.cumulative_external_capital);
        const target = investment * targetMultiple;
        
        let count = 0;
        for (const path of allPaths) {
            const val = Number(path[idx]);
            if (val >= target) count++;
        }
        return count / allPaths.length;
    });

    // Calculate DPI Array (Distributed to Paid-In)
    const dpi = p50Data.map(d => {
        const dist = Number(d.cumulative_dividends);
        const inv = Number(d.cumulative_external_capital);
        return inv > 0 ? dist / inv : 0;
    });

    return { likelihoodData: likelihood, dpiData: dpi };

  }, [simulation, p50Data, allPaths, targetMultiple]);

  const handlePrevPath = () => {
      setPathIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextPath = () => {
      const maxPaths = allPaths.length || 1000;
      setPathIndex(prev => Math.min(maxPaths - 1, prev + 1));
  };

  // 4. Monte Carlo Data (Fan Mode)
  const fanData = simulation ? extractFanData(simulation) : undefined;

  // 5. Global Scale Calculation (Unified Min/Max)
  const { globalMin, globalMax } = useMemo(() => {
    const values: number[] = [];
    
    const push = (arr?: any[]) => {
        if (!arr) return;
        arr.forEach(v => {
            const n = Number(v);
            if (!isNaN(n)) values.push(n);
        });
    };

    // Deterministic
    push(deterministicValues);
    push(deterministicInvestment);

    // Single Path (Current)
    push(singlePathValues);
    push(singlePathInvestment);

    // Fan Data (Envelope)
    if (fanData) {
        push(fanData.p0);
        push(fanData.p100);
    }

    if (values.length === 0) return { globalMin: 0, globalMax: 100 };

    return {
        globalMin: Math.min(...values),
        globalMax: Math.max(...values)
    };
  }, [deterministicValues, deterministicInvestment, singlePathValues, singlePathInvestment, fanData]);

  if (loading) return <Layout>Loading...</Layout>;
  if (!fund) return <Layout>Fund not found</Layout>;

  // --- ERROR BLOCK ---
  if (simulation?.errors && simulation.errors.length > 0) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto mt-8 bg-red-50 border-l-4 border-red-500 p-6 rounded shadow-sm">
           <h2 className="text-red-800 font-bold text-lg mb-2 flex items-center gap-2">
             ⚠️ Simulation Failed
           </h2>
           <p className="text-red-700 mb-3">The financial model could not resolve the following issues:</p>
           <ul className="list-disc pl-5 space-y-1 text-red-600 font-medium">
              {simulation.errors.map((e, i) => <li key={i}>{e}</li>)}
           </ul>
           <button onClick={() => window.location.reload()} className="mt-4 bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded text-sm font-bold transition-colors">
              Reload & Try Again
           </button>
        </div>
      </Layout>
    );
  }

  const currency = fund.currency_code || '$';

  // Helper
  const fmt = (n: any) => 
    `${currency} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  // HARDENED: Unified Labels
  const chartLabels = simulation?.labels || [];

  // Determine visibility
  const showStandard = viewMode === 'standard' && simulation;
  const showMonteCarlo = viewMode === 'monte_carlo' && simulation;
  const hasData = !!simulation;

  // Active Data for KPIs
  const activeData = simulation;
  const isSingleMode = viewMode === 'single';

  // Final Values for Cards
  const lastLikelihood = likelihoodData.length > 0 ? likelihoodData[likelihoodData.length - 1] : 0;
  const lastDpi = dpiData.length > 0 ? dpiData[dpiData.length - 1] : 0;

  return (
    <Layout>
      <nav className='mb-6 flex justify-between items-center'>
        <Link href={`/fund/${fundId}/inputs`} className='text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium transition-colors'>
          <ArrowLeft className='h-4 w-4' />
          Back to Configuration
        </Link>
      </nav>

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">{fund.fund_name} <span className="text-gray-400 font-normal">Projections</span></h1>
            <p className="text-gray-500 text-sm">Aggregated Portfolio Performance</p>
        </div>
        
        {/* CONTROLS BAR */}
        <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-lg shadow-sm border border-gray-200">
              
              {/* Mode Selector */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Simulation Mode</label>
                <select 
                  className="border rounded p-1.5 text-sm font-bold text-blue-800 bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as ViewMode)}
                >
                  <option value="standard">Standard (Deterministic)</option>
                  <option value="single">Single Path (Volatile)</option>
                  <option value="monte_carlo">Monte Carlo (Fan)</option>
                </select>
              </div>

              <div className="w-px h-8 bg-gray-300 mx-1"></div>

              {/* Years Selector */}
              <div className="flex flex-col gap-1">
                 <label className="text-xs font-semibold text-gray-500 uppercase">Duration</label>
                 <select 
                    value={years} 
                    onChange={(e) => setYears(Number(e.target.value))}
                    className="border rounded p-1.5 text-sm font-bold text-blue-800 bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none min-w-[100px]"
                 >
                    {YEAR_OPTIONS.map(y => (
                        <option key={y} value={y}>{y} Years</option>
                    ))}
                 </select>
              </div>

              {/* Pooling Slider (Visible for single and monte_carlo) */}
              {viewMode !== 'standard' && (
                <>
                    <div className="w-px h-8 bg-gray-300 mx-1"></div>
                    <div className="flex flex-col gap-1 w-40 animate-in fade-in slide-in-from-left-2 duration-300">
                            <div className="flex justify-between">
                            <label className="text-xs font-semibold text-gray-500 uppercase">ERGODICITY CORRECTION</label>
                            <span className="text-xs font-bold text-indigo-600">{poolingFraction}%</span>
                            </div>
                            <input 
                            type="range" min="0" max="100" step="5"
                            value={poolingFraction} onChange={(e) => setPoolingFraction(parseInt(e.target.value))}
                            className="h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                    </div>
                </>
              )}

              <div className="w-px h-8 bg-gray-300 mx-1"></div>

              {/* Target Multiple Input */}
              <div className="flex flex-col gap-1">
                 <label className="text-xs font-semibold text-gray-500 uppercase">Target Multiple</label>
                 <div className="flex items-center gap-1">
                    <input 
                        type="number" 
                        min="1.0" 
                        step="0.1"
                        value={targetMultiple}
                        onChange={(e) => setTargetMultiple(Number(e.target.value))}
                        className="w-16 border rounded p-1.5 text-sm font-bold text-purple-800 bg-purple-50 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <span className="text-sm font-bold text-gray-400">x</span>
                 </div>
              </div>

              <div className="w-px h-8 bg-gray-300 mx-1"></div>

              {/* Toggles */}
              <div className="flex flex-col gap-2 px-2">
                <div className="flex items-center gap-2">
                    <input 
                    type="checkbox" id="logScale" 
                    checked={isLogScale} onChange={(e) => setIsLogScale(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <label htmlFor="logScale" className="text-xs font-medium cursor-pointer text-gray-700">Log Scale</label>
                </div>
                <div className="flex items-center gap-2">
                    <input 
                    type="checkbox" id="includeCapital" 
                    checked={includeInitialCapital} onChange={(e) => setIncludeInitialCapital(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <label htmlFor="includeCapital" className="text-xs font-medium cursor-pointer text-gray-700">Incl. Capital</label>
                </div>
                {/* NEW CHECKBOX */}
                <div className="flex items-center gap-2">
                    <input 
                    type="checkbox" id="eventsActive" 
                    checked={eventsActive} onChange={(e) => setEventsActive(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                    />
                    <label htmlFor="eventsActive" className="text-xs font-medium cursor-pointer text-purple-700">Events Active</label>
                </div>
                <div className="flex items-center gap-2">
                    <input 
                    type="checkbox" id="stopInsolvency" 
                    checked={stopInsolvency} onChange={(e) => setStopInsolvency(e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                    />
                    <label htmlFor="stopInsolvency" className="text-xs font-medium cursor-pointer text-red-700">Stop if Insolvent</label>
                </div>
              </div>

        </div>
      </div>

      {simLoading ? (
          <div className="h-96 flex flex-col items-center justify-center bg-gray-50 border rounded-lg animate-pulse text-gray-400 font-medium gap-2">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
              <span>Running Simulation...</span>
          </div>
      ) : hasData ? (
          <>
            {isSingleMode ? (
                // SINGLE MODE LAYOUT
                <div className="flex flex-col gap-6 mb-12 animate-in fade-in duration-500">
                    
                    {/* Charts Row */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                          <Card className="border-t-4 border-gray-400 h-full">
                              <div className="flex justify-between items-center mb-4">
                                  <div>
                                      <h2 className="text-lg font-bold text-gray-800">Deterministic Baseline</h2>
                                      <p className="text-xs text-gray-500 mt-1">Zero volatility projection.</p>
                                  </div>
                              </div>
                              <div className="h-[500px]">
                                  <FundChart 
                                      mode="standard"
                                      labels={chartLabels}
                                      values={deterministicValues}
                                      investmentValues={deterministicInvestment}
                                      currencySymbol={currency}
                                      isLog={isLogScale}
                                      minY={globalMin}
                                      maxY={globalMax}
                                  />
                              </div>
                          </Card>

                          <Card className="border-t-4 border-indigo-500 h-full">
                              <div className="flex justify-between items-center mb-4">
                                  <div>
                                      <div className="flex items-center gap-2">
                                          <h2 className="text-lg font-bold text-gray-800">Volatile Reality</h2>
                                          <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100">Stochastic</span>
                                      </div>
                                      <p className="text-xs text-gray-500 mt-1">Single stochastic trajectory</p>
                                  </div>
                                  
                                  <div className="flex items-center gap-1 bg-gray-100 rounded p-1 border border-gray-200">
                                      <button 
                                          onClick={handlePrevPath}
                                          disabled={pathIndex <= 0}
                                          className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-blue-600 hover:bg-white rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                      >
                                          ←
                                      </button>
                                      <span className="text-xs font-mono font-bold text-gray-700 px-2 min-w-[80px] text-center">
                                          Path {pathIndex + 1} / {allPaths.length || 1000}
                                      </span>
                                      <button 
                                          onClick={handleNextPath}
                                          disabled={!simulation || pathIndex >= (allPaths.length || 1000) - 1}
                                          className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-blue-600 hover:bg-white rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                      >
                                          →
                                      </button>
                                  </div>
                              </div>
                              <div className="h-[500px]">
                                  <FundChart 
                                      mode="single"
                                      labels={chartLabels}
                                      values={singlePathValues}
                                      investmentValues={singlePathInvestment}
                                      currencySymbol={currency}
                                      isLog={isLogScale}
                                      targetProbability={likelihoodData}
                                      targetMultiple={targetMultiple}
                                      minY={globalMin}
                                      maxY={globalMax}
                                  />
                              </div>
                          </Card>
                    </div>

                    {/* KPI Row */}
                    <div className="w-full">
                        {activeData && (
                            <>
                                <Card className='mb-4 border-l-4 border-purple-500 p-4'>
                                    <div className='text-xs font-bold text-gray-500 uppercase'>Avg. Shocks (Universe)</div>
                                    <div className='text-2xl font-bold text-gray-900'>{simulation?.average_event_count?.toFixed(1) ?? 0}</div>
                                    <div className='text-xs text-gray-400'>Events per lifetime</div>
                                </Card>
                                <FundKPICards 
                                    data={activeData} 
                                    currency={currency} 
                                    mode="single"
                                    currentPathValues={currentPathValues}
                                    isRow={true}
                                    targetMultiple={targetMultiple}
                                    dpiValue={lastDpi}
                                    likelihoodValue={lastLikelihood}
                                />
                            </>
                        )}
                    </div>
                </div>
            ) : (
                // SIDEBAR LAYOUT (Standard & Monte Carlo)
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-12 animate-in fade-in duration-500">
                    
                    {/* LEFT COLUMN: CHART (3/4 width) */}
                    <div className="lg:col-span-3 space-y-6">
                        {showStandard && (
                            <Card className="border-t-4 border-gray-400 h-full">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <h2 className="text-lg font-bold text-gray-800">Deterministic Projection</h2>
                                            <p className="text-xs text-gray-500 mt-1">Standard linear projection without volatility.</p>
                                        </div>
                                    </div>
                                    <div className="h-[500px]">
                                        <FundChart 
                                            mode="standard"
                                            labels={chartLabels}
                                            values={deterministicValues}
                                            investmentValues={deterministicInvestment}
                                            currencySymbol={currency}
                                            isLog={isLogScale}
                                            minY={globalMin}
                                            maxY={globalMax}
                                        />
                                    </div>
                            </Card>
                        )}

                        {showMonteCarlo && (
                            <Card className="border-t-4 border-indigo-500 h-full">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <h2 className="text-lg font-bold text-gray-800">
                                                Probabilistic Envelope (P0-P100)
                                            </h2>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Showing the full range of possible outcomes across 1,000 iterations.
                                            </p>
                                        </div>
                                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">Target Probability Overlay Active</span>
                                    </div>
                                    <div className="h-[500px]">
                                        <FundChart 
                                            mode="monte_carlo"
                                            labels={chartLabels}
                                            fanData={fanData}
                                            investmentValues={deterministicInvestment}
                                            targetProbability={likelihoodData}
                                            targetMultiple={targetMultiple}
                                            currencySymbol={currency}
                                            isLog={isLogScale}
                                            minY={globalMin}
                                            maxY={globalMax}
                                        />
                                    </div>
                            </Card>
                        )}
                        
                        {/* Info Text */}
                        <div className="flex justify-center">
                            <span className="text-xl font-medium text-gray-500 bg-gray-50 px-3 py-1 rounded-full border border-gray-100 block text-center">
                                Total Fund Value = Sum(Company Cash + Dividends Paid)<br />
                                We do everything on a cash basis, not accrual, so that the impact of insolvency is visible.
                            </span>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: KPIs (1/4 width) */}
                    <div className="lg:col-span-1 flex flex-col gap-4">
                        {activeData && (
                            <div className="sticky top-6">
                                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">Key Metrics</h3>
                                <Card className='mb-4 border-l-4 border-purple-500 p-4'>
                                    <div className='text-xs font-bold text-gray-500 uppercase'>Avg. Shocks (Universe)</div>
                                    <div className='text-2xl font-bold text-gray-900'>{simulation?.average_event_count?.toFixed(1) ?? 0}</div>
                                    <div className='text-xs text-gray-400'>Events per lifetime</div>
                                </Card>
                                <FundKPICards 
                                    data={activeData} 
                                    currency={currency} 
                                    mode={viewMode === 'standard' ? 'standard' : 'monte_carlo'}
                                    currentPathValues={currentPathValues}
                                    isRow={false}
                                    targetMultiple={targetMultiple}
                                    dpiValue={lastDpi}
                                    likelihoodValue={lastLikelihood}
                                />
                            </div>
                        )}
                    </div>

                </div>
            )}

            {/* NEW TABLE SECTION */}
            <Card className="overflow-x-auto max-h-96 mt-6 border-t-4 border-gray-600">
                <h3 className="text-lg font-bold text-gray-700 mb-4 px-4 pt-4">Aggregate Fund Flows (P50 Median)</h3>
                <table className="min-w-full text-xs text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                    <tr>
                        <th className="px-4 py-3">Month</th>
                        <th className="px-4 py-3">Net Income (P50)</th>
                        <th className="px-4 py-3">Cash (P50)</th>
                        <th className="px-4 py-3 text-red-600">Total Pool Contrib.</th>
                        <th className="px-4 py-3 text-green-600">Total Pool Recv.</th>
                        <th className="px-4 py-3">Contributors</th>
                        <th className="px-4 py-3">Solvent Cos</th>
                    </tr>
                    </thead>
                    <tbody>
                    {p50Data.map((row: any) => (
                        <tr key={row.month_index} className="border-b hover:bg-gray-50 bg-white">
                            <td className="px-4 py-2 font-medium">{row.month_index}</td>
                            <td className="px-4 py-2">{fmt(row.net_income)}</td>
                            <td className="px-4 py-2 font-bold">{fmt(row.cash_balance)}</td>
                            <td className="px-4 py-2 text-red-600">{row.pool_contribution ? fmt(row.pool_contribution) : '-'}</td>
                            <td className="px-4 py-2 text-green-600">{row.pool_received ? fmt(row.pool_received) : '-'}</td>
                            <td className="px-4 py-2">{row.contributing_companies ?? '-'}</td>
                            <td className="px-4 py-2">{row.solvent_companies ?? '-'}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </Card>
          </>
      ) : (
          <div className="h-64 bg-gray-50 border border-dashed rounded-lg flex items-center justify-center text-gray-400 mb-12">
              No simulation data available. Check your configuration.
          </div>
      )}
    </Layout>
  );
}
