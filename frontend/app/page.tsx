'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import DeleteButton from '@/components/ui/DeleteButton';
import { api, Fund, Company } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function Dashboard() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [funds, setFunds] = useState<Fund[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

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
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  // Helper: Delete Fund
  const handleDeleteFund = async (fundId: string) => {
    if (!confirm('Are you sure you want to delete this fund?')) return;
    try {
      await api.deleteFund(fundId);
      fetchData(); // Refresh list
    } catch (error) {
      alert('Could not delete fund. It might contain companies.');
    }
  };

  if (authLoading || !isAuthenticated || dataLoading) return <Layout>Loading...</Layout>;

  return (
    <Layout>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex gap-4">
          <Link 
            href="/structure" 
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            New Fund
          </Link>
          <Link 
            href="/structure" 
            className="bg-indigo-600 text-white border border-indigo-600 px-4 py-2 rounded-md hover:bg-indigo-50 transition-colors text-sm font-medium"
          >
            New Company
          </Link>
        </div>
      </div>

      <p className="text-s text-gray-400 font-mono">This is an alpha release for early developmental testing, feedback, and educational purposes only. We may at any stage need to do a complete clean reset, at which point all of your data and login details may be lost.</p> <p></p>

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
                    <ul className="space-y-2">
                      {fundCompanies.map((company) => (
                        <li key={company.id}>
                          <Link 
                            href={`/company/${company.id}`}
                            className="block p-3 bg-gray-50 rounded border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-gray-700 group-hover:text-indigo-700">
                                {company.name}
                              </span>
                              <span className="text-gray-400 group-hover:text-indigo-400 text-sm">View &rarr;</span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-gray-400 italic py-4 text-center bg-gray-50 rounded border border-dashed">
                      No companies yet.
                    </div>
                  )}
                </div>

                {/* ADD COMPANY LINK */}
                <div className="mt-4 pt-3 border-t border-gray-100 text-center">
                  <Link 
                    href="/structure" 
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800 inline-flex items-center"
                  >
                    <span className="mr-1">+</span> Add Company
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
          <div className="mt-6">
             <Link 
                href="/structure" 
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors"
              >
                Create Fund
              </Link>
          </div>
        </div>
      )}
    </Layout>
  );
}
