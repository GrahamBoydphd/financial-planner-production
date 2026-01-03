'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import DeleteButton from '@/components/ui/DeleteButton';
import { api, Fund, Company } from '@/lib/api';
import Link from 'next/link';

export default function Dashboard() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [fundsData, companiesData] = await Promise.all([
        api.getFunds(),
        api.getCompanies()
      ]);
      setFunds(fundsData);
      setCompanies(companiesData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper: Delete Fund
  const handleDeleteFund = async (fundId: string) => {
    try {
      await api.deleteFund(fundId);
      fetchData(); // Refresh list
    } catch (error) {
      alert('Could not delete fund. It might contain companies.');
    }
  };

  // Helper: Delete Company
  const handleDeleteCompany = async (companyId: string) => {
    if(!confirm("Are you sure? This will delete all financial plans associated with this company.")) return;
    
    try {
      await api.deleteCompany(companyId);
      fetchData(); // Refresh list
    } catch (error) {
      console.error(error);
      alert('Failed to delete company.');
    }
  };

  if (loading) return <Layout>Loading...</Layout>;

  return (
    <Layout>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="space-x-4">
          <Link 
            href="/fund/new"
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors"
          >
            + New Fund
          </Link>
          <Link 
            href="/company/new"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            + New Company
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {funds.map((fund) => {
          // Find companies belonging to this fund
          const fundCompanies = companies.filter(c => c.fund_id === fund.id);

          return (
            <div key={fund.id} className="flex flex-col h-full">
              <Card className="flex-1 flex flex-col border-t-4 border-t-indigo-500 hover:shadow-lg transition-shadow">
                
                {/* FUND HEADER */}
                <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{fund.name}</h2>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mt-1">Fund</p>
                  </div>
                  <DeleteButton onDelete={() => handleDeleteFund(fund.id)} />
                </div>

                {/* COMPANIES LIST */}
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Portfolio Companies</h3>
                  
                  {fundCompanies.length > 0 ? (
                    <ul className="space-y-3">
                      {fundCompanies.map((company) => (
                        <li key={company.id} className="group flex justify-between items-center bg-gray-50 p-3 rounded-md hover:bg-blue-50 transition-colors border border-gray-100">
                          <Link href={`/company/${company.id}`} className="font-medium text-blue-600 hover:underline">
                            {company.name}
                          </Link>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                             <DeleteButton onDelete={() => handleDeleteCompany(company.id)} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-gray-400 italic py-4 text-center bg-gray-50 rounded border border-dashed">
                      No companies yet.
                    </div>
                  )}
                </div>

                {/* FOOTER */}
                <div className="mt-6 pt-4 border-t border-gray-100 text-right">
                   <Link href="/company/new" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                      + Add Company
                   </Link>
                </div>
              </Card>
            </div>
          );
        })}
      </div>
      
      {funds.length === 0 && (
        <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <h3 className="text-xl font-medium text-gray-500">No funds found</h3>
          <p className="text-gray-400 mt-2">Get started by creating your first fund.</p>
          <Link href="/fund/new" className="inline-block mt-4 text-indigo-600 font-bold hover:underline">
            Create Fund &rarr;
          </Link>
        </div>
      )}
    </Layout>
  );
}
