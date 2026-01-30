'use client';

import React, { useEffect, useState } from 'react';
import { api, SimulationResult, MonthlyData } from '../../../../lib/api';

export default function ClientPage({ params }: { params: { planId: string } }) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await api.getProjection(params.planId);
        setResult(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load simulation results.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [params.planId]);

  if (loading) return <div className="p-8 text-gray-500">Loading simulation engine...</div>;
  if (error) return <div className="p-8 text-red-600 font-medium">{error}</div>;
  if (!result || !result.p50_data) return <div className="p-8 text-gray-500">No simulation data found. Please run the simulation.</div>;

  const formatCurrency = (val: string | undefined) => {
    if (!val) return '$0.00';
    const num = parseFloat(val);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Simulation Results (P50 Median)</h1>
        <div className="text-sm text-gray-500">
          Runway: <span className="font-medium text-gray-900">{result.p50_runway ?? 0} Months</span>
        </div>
      </div>

      <div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 sticky left-0 bg-gray-50">Month</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Revenue</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">COGS</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Gross Profit</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">OpEx</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Net Income</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Treasury Gain</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Cash Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {result.p50_data.map((m: MonthlyData) => {
                const tGain = parseFloat(m.treasury_gain || '0');
                const netIncome = parseFloat(m.net_income);
                
                return (
                  <tr key={m.month_index} className={`hover:bg-gray-50 ${!m.is_solvent ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-2 text-gray-900 font-medium sticky left-0 bg-white">{m.month_index}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(m.revenue)}</td>
                    <td className="px-4 py-2 text-right text-red-600">({formatCurrency(m.cogs)})</td>
                    <td className="px-4 py-2 text-right text-gray-900 font-medium">{formatCurrency(m.gross_profit)}</td>
                    <td className="px-4 py-2 text-right text-red-600">({formatCurrency(m.opex)})</td>
                    <td className={`px-4 py-2 text-right font-medium ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(m.net_income)}
                    </td>
                    <td className={`px-4 py-2 text-right font-medium ${tGain > 0 ? 'text-green-600' : tGain < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {m.treasury_gain ? formatCurrency(m.treasury_gain) : '-'}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-gray-900">{formatCurrency(m.cash_balance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
