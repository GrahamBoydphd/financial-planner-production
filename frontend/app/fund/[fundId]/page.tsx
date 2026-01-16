'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import { api, Fund, Company } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function FundPage({ params }: { params: { fundId: string } }) {
  const { fundId } = params;
  const [fund, setFund] = useState<Fund | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const f = await api.getFund(fundId);
      setFund(f);
      
      // For now, fetch all companies and filter client-side 
      // (Optimization: Add getCompaniesByFund endpoint later)
      const allCompanies = await api.getCompanies();
      setCompanies(allCompanies.filter(c => c.fund_id === fundId));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fundId]);

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
        <h1 className="text-3xl font-bold text-gray-900">{fund.name} <span className="text-gray-400 text-lg">Portfolio</span></h1>
        <div className="flex flex-col items-end">
          <Link
            href="/structure#add-company"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            + Add Company
          </Link>
          <span className="text-xs text-gray-500 mt-1 max-w-[250px] text-right">
            Companies must be added via the Holding Structure to ensure all parameters are set correctly.
          </span>
        </div>
      </div>

      {companies.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded border border-dashed">
            <h3 className="text-lg font-bold text-gray-600">No Companies Yet</h3>
            <p className="text-gray-400 mb-4">Add your first portfolio company to start modeling.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map(co => (
                <Link key={co.id} href={`/company/${co.id}`}>
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-purple-500 h-full">
                        <h2 className="text-xl font-bold text-gray-800">{co.name}</h2>
                        <p className="text-sm text-gray-500 mt-1">{co.industry || 'General'}</p>
                    </Card>
                </Link>
            ))}
        </div>
      )}
    </Layout>
  );
}
