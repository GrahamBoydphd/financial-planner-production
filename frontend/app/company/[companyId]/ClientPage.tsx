'use client';

import { useEffect, useState } from 'react';
import { api, MonthlyData } from '../../../lib/api';

export default function ClientPage({ params }: { params: { companyId: string } }) {
  const [data, setData] = useState<MonthlyData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch plans for the company
        const plans = await api.getPlans();
        const companyPlan = plans.find(p => p.company_id === params.companyId);
        
        if (companyPlan) {
          const projection = await api.getProjection(companyPlan.id);
          setData(projection.p50_data);
        } else {
          setError('No financial plan found for this company.');
        }
      } catch (e) {
        console.error("Failed to fetch data", e);
        setError('Failed to load financial data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.companyId]);

  if (loading) return <div className="p-6">Loading financial data...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return <div className="p-6">No data available.</div>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Financial Projection (P50)</h2>
      <div className="overflow-x-auto border rounded-lg shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">OpEx</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Income</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cash</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Treasury Gain</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((m) => {
              const treasuryGain = parseFloat(m.treasury_gain || '0');
              const gainClass = treasuryGain > 0 
                ? 'text-green-600' 
                : treasuryGain < 0 
                  ? 'text-red-600' 
                  : 'text-gray-500';

              return (
                <tr key={m.month_index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{m.month_index}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(m.revenue)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(m.opex)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(m.net_income)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(m.cash_balance)}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${gainClass}`}>
                    {m.treasury_gain ? formatCurrency(m.treasury_gain) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCurrency(val: string) {
  const num = parseFloat(val);
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}
