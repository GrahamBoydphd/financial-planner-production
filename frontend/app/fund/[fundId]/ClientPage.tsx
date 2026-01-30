'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import CashFlowChart from '@/components/CashFlowChart';
import Button from '@/components/ui/Button';
import { api, Fund, SimulationResult } from '@/lib/api';

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
    const singleLastData = projection.single_run_data?.[projection.single_run_data.length - 1];

    let totalVal = lastData.total_value;
    let valuation = projection.deterministic_valuation;
    let subtitle = 'Deterministic Average';
    let insolvencyMonth = -1;
    let runwayVal: number | string = 'Infinite';

    const checkInsolvency = (dataArray: any[]) => {
        if (!dataArray) return -1;
        const idx = dataArray.findIndex(m => 
            (m.is_solvent === false) || 
            (m.is_insolvent === true) || 
            Number(m.cash_balance) < -(Number(creditLimit) || 0)
        );
        return idx !== -1 ? dataArray[idx].month_index : -1;
    };

    const calculateRunway = (cash: number, netIncome: number) => {
        if (netIncome >= 0) return 'Infinite';
        const burn = -netIncome;
        const available = cash + Number(creditLimit);
        if (available <= 0) return 0;
        return Math.floor(available / burn);
    };

    if (simMode === 'single') {
        if (singleLastData) {
            totalVal = singleLastData.total_value;
            valuation = projection.single_run_valuation;
            subtitle = 'Single Run Result';
            insolvencyMonth = checkInsolvency(projection.single_run_data);
            runwayVal = calculateRunway(Number(singleLastData.cash_balance), Number(singleLastData.net_income));
        } else {
            totalVal = 0;
            subtitle = 'Data Unavailable';
            runwayVal = 0;
        }
    } else if (simMode === 'monte_carlo') {
        totalVal = projection.p50_value?.[projection.p50_value.length - 1] || 0;
        valuation = projection.p50_valuation;
        subtitle = 'Median (P50)';
        
        const lastP50 = projection.p50_data?.[projection.p50_data.length - 1];
        const isP50Insolvent = lastP50 && (
            lastP50.is_solvent === false || 
            Number(lastP50.cash_balance) <= 0
        );

        const backendRunway = projection.p50_runway ?? 'Infinite';

        if (isP50Insolvent) {
            runwayVal = 0;
        } else {
            runwayVal = backendRunway;
        }
        
    } else {
        insolvencyMonth = checkInsolvency(projection.deterministic_data);
        runwayVal = calculateRunway(Number(lastData.cash_balance), Number(lastData.net_income));
    }

    const p90Val = projection.p90_value?.[projection.p90_value.length - 1] || 0;

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
                    <p className="text-xs text-gray-500">Comparing cash: realistic projection is: </p>
                    <p className={`text-lg font-bold ${cashDelta < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {cashDelta > 0 ? '+' : ''}{fmt(cashDelta)}
                    </p>
                    <p className="text-xs text-gray-500"> vs. conventional (unrealistic) projection</p>
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

        <Card className="text-center mb-4">
            <h3 className="text-gray-500 text-sm uppercase">Avg. Shocks (Universe)</h3>
            <p className="text-2xl font-bold text-indigo-600">
                {projection.average_event_count?.toFixed(1) ?? 0}
            </p>
            <p className="text-xs text-gray-400 mt-1">Events per lifetime</p>
        </Card>
      </>
    );
};

export default function ClientPage({ params }: { params: { fundId: string } }) {
  const { fundId } = params;
  const [fund, setFund] = useState<Fund | null>(null);
  const [projection, setProjection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Controls
  const [years, setYears] = useState(5);
  const [isLogScale, setIsLogScale] = useState(true);
  const [simMode, setSimMode] = useState<'single' | 'monte_carlo' | 'standard'>('standard');
  const [stopInsolvency, setStopInsolvency] = useState(true);
  const [eventsActive, setEventsActive] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Path Navigation
  const [pathIndex, setPathIndex] = useState(0);
  
  // Non-Ergodicity State
  const [poolingFraction, setPoolingFraction] = useState(0);
  const [updatingPooling, setUpdatingPooling] = useState(false);

  // UI Settings
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const f = await api.getFund(fundId);
        setFund(f);
        setCurrency(f.currency_code || 'USD');

        const proj = await api.getFundSimulation(fundId, {
           months: years * 12,
           stop_insolvency: stopInsolvency,
           fund_pooling_fraction: (poolingFraction / 100.0).toString(),
           events_active: eventsActive
        });

        // Data Mapping
        let sourceData = (simMode === 'standard') ? proj.deterministic_data : [];
        if (simMode === 'monte_carlo' && proj.p50_data) {
            sourceData = proj.p50_data;
        } else if (simMode === 'single' && proj.single_run_data) {
            sourceData = proj.single_run_data;
        }

        const tableData = sourceData ? sourceData.map((m: any) => {
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
               treasury_gain: m.treasury_gain,
               is_solvent: m.is_solvent
           };
        }) : [];
        
        (proj as any).cash_flow_data = tableData;
        setProjection(proj);
        setPathIndex(0);

      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
        setUpdatingPooling(false);
      }
    };
    load();
  }, [fundId, years, simMode, stopInsolvency, eventsActive, poolingFraction, refreshTrigger]);

  const handlePoolingChange = (val: number) => {
      setPoolingFraction(val);
  };

  const handlePoolingCommit = () => {
      // For funds, we might not save to DB immediately or we might. 
      // Here we just trigger refresh as the param is passed in query.
      setRefreshTrigger(n => n + 1);
  };

  // Helper
  const fmt = (n: any) => 
    `${currency} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const totalPaths = projection?.all_paths?.length || 0;
  const currentPathData = projection?.all_paths?.[pathIndex];

  if (!fund) return <Layout>Loading...</Layout>;

  return (
    <Layout>
      <nav className='mb-6'>
        <Link href="/dashboard" className='text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium transition-colors'>
          <ArrowLeft className='h-4 w-4' />
          Return to Dashboard
        </Link>
      </nav>

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fund {fund.fund_name} - Aggregate Projections</h1>
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

              <div className="flex items-center gap-2 border-l pl-4">
                  <span className="text-xs text-gray-500">Currency:</span>
                  <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded text-gray-700 border">
                      {fund.currency_code || 'USD'}
                  </span>
              </div>

              <div className="flex items-center gap-2 border-l pl-4">
                <input 
                  type="checkbox" id="stopInsolvency" 
                  checked={stopInsolvency} onChange={(e) => setStopInsolvency(e.target.checked)}
                  className="rounded text-red-600"
                />
                <label htmlFor="stopInsolvency" className="text-sm font-medium cursor-pointer text-red-800">Stop on Insolvency</label>
              </div>

              <div className="flex items-center gap-2 border-l pl-4">
                <input 
                  type="checkbox" id="eventsActive" 
                  checked={eventsActive} onChange={(e) => setEventsActive(e.target.checked)}
                  className="rounded text-purple-600"
                />
                <label htmlFor="eventsActive" className="text-sm font-medium cursor-pointer text-purple-800">Events Active</label>
              </div>

              {simMode === 'monte_carlo' && (
                <div className="flex flex-col justify-center border-l pl-4 w-40">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider cursor-help" title="Strength of the correction factor for non-ergodicity.">Ergodicity Correction</span>
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
                      onChange={(e) => handlePoolingChange(Number(e.target.value))}
                      onMouseUp={handlePoolingCommit}
                      onTouchEnd={handlePoolingCommit}
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
                    creditLimit={0}
                    currencySymbol={`${currency} `}
                  />
                </div>
              </Card>
              <Card>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-blue-700">Volatile (Single Run)</h2>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Stochastic</span>
                  </div>
                  
                  {totalPaths > 1 && (
                    <div className="flex items-center gap-1 bg-gray-100 rounded p-1 border border-gray-200">
                        <button 
                            onClick={() => setPathIndex(i => Math.max(0, i - 1))}
                            disabled={pathIndex === 0}
                            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-blue-600 hover:bg-white rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                            ←
                        </button>
                        <span className="text-xs font-mono font-bold text-gray-700 px-2 min-w-[80px] text-center">
                            Path {pathIndex + 1} / {totalPaths}
                        </span>
                        <button 
                            onClick={() => setPathIndex(i => Math.min(totalPaths - 1, i + 1))}
                            disabled={pathIndex >= totalPaths - 1}
                            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-blue-600 hover:bg-white rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                            →
                        </button>
                    </div>
                  )}
                </div>
                <div className="h-80">
                  <CashFlowChart 
                    data={projection} 
                    singleRunData={currentPathData}
                    isLog={isLogScale} 
                    mode="single" 
                    creditLimit={0}
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
                      creditLimit={0}
                      currencySymbol={`${currency} `}
                    />
                  </div>
                </Card>
              </div>
              <div className="w-full lg:w-64 flex-shrink-0">
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                   <KPICards simMode={simMode} projection={projection} creditLimit={'0'} stopInsolvency={stopInsolvency} currency={currency} valuationMethod={'revenue'} />
                </div>
              </div>
            </div>
          )}

          {simMode === 'single' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <KPICards simMode={simMode} projection={projection} creditLimit={'0'} stopInsolvency={stopInsolvency} currency={currency} valuationMethod={'revenue'} />
            </div>
          )}

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
                  <th className="px-4 py-3 text-right text-green-700">Treasury Gain</th>
                  <th className="px-4 py-3 text-orange-600">Pool Received</th>
                  <th className="px-4 py-3 text-gray-900 font-bold">Cash Bal</th>
                  <th className="px-4 py-3 text-green-600">Dividends</th>
                  <th className="px-4 py-3 text-blue-700 font-bold">Net Value</th>
                </tr>
              </thead>
              <tbody>
                {(projection as any).cash_flow_data.length > 0 ? (
                    (projection as any).cash_flow_data.map((row: any) => {
                      const isRowInsolvent = !row.is_solvent;
                      return (
                      <tr key={row.month_index} className={`border-b ${isRowInsolvent ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50 bg-white'}`}>
                        <td className="px-4 py-2 font-medium">{row.month_index}</td>
                        <td className="px-4 py-2">{fmt(row.revenue)}</td>
                        <td className="px-4 py-2">{fmt(row.gross_profit)}</td>
                        <td className="px-4 py-2">{fmt(row.opex)}</td>
                        <td className={`px-4 py-2 ${isRowInsolvent ? '' : (row.net_income < 0 ? 'text-red-500' : 'text-green-600')}`}>{fmt(row.net_income)}</td>
                        <td className={`px-4 py-2 text-right ${isRowInsolvent ? '' : (row.treasury_gain > 0 ? 'text-green-600' : row.treasury_gain < 0 ? 'text-red-600' : 'text-gray-400')}`}>{row.treasury_gain ? fmt(row.treasury_gain) : '-'}</td>
                        <td className={`px-4 py-2 ${isRowInsolvent ? '' : 'text-orange-600'}`}>{fmt(row.cumulative_pool_received)}</td>
                        <td className={`px-4 py-2 font-bold ${isRowInsolvent ? '' : (row.cash_balance < 0 ? 'text-red-600' : 'text-gray-900')}`}>{fmt(row.cash_balance)}</td>
                        <td className={`px-4 py-2 ${isRowInsolvent ? '' : 'text-green-600'}`}>{row.dividend_paid > 0 ? fmt(row.dividend_paid) : '-'}</td>
                        <td className={`px-4 py-2 font-bold ${isRowInsolvent ? '' : (row.total_value < 0 ? 'text-red-600' : 'text-blue-700')}`}>
                          {fmt(row.total_value)}
                        </td>
                      </tr>
                      );
                    })
                ) : (
                    <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-gray-400 italic">
                            Data Unavailable for this mode.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded border-2 border-dashed border-gray-300">
            <p className="text-xl font-bold text-gray-400 mb-2">No Data Available</p>
            <p className="text-gray-500">Ensure companies in this fund have financial plans.</p>
        </div>
      )}
    </Layout>
  );
}
