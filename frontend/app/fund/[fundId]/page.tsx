'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import { api, Fund, Company } from '@/lib/api';
import Link from 'next/link';

export default function FundPage({ params }: { params: { fundId: string } }) {
  const { fundId } = params;
  const [fund, setFund] = useState<Fund | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Company State
  const [isCreating, setIsCreating] = useState(false);
  const [newCoName, setNewCoName] = useState('');
  const [newCoIndustry, setNewCoIndustry] = useState('');

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

  const handleCreateCompany = async () => {
    if (!newCoName) return;
    await api.createCompany(newCoName, fundId, newCoIndustry);
    setNewCoName('');
    setNewCoIndustry('');
    setIsCreating(false);
    loadData();
  };

  if (loading) return <Layout>Loading...</Layout>;
  if (!fund) return <Layout>Fund not found</Layout>;

  return (
    <Layout>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <span>{fund.name}</span>
      </div>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{fund.name} <span className="text-gray-400 text-lg">Portfolio</span></h1>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 font-medium"
        >
          + Add Company
        </button>
      </div>

      {isCreating && (
        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded animate-fade-in">
            <h3 className="font-bold text-purple-800 mb-2">Add Portfolio Company</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input 
                    className="border p-2 rounded" 
                    placeholder="Company Name" 
                    value={newCoName}
                    onChange={(e) => setNewCoName(e.target.value)}
                />
                <input 
                    className="border p-2 rounded" 
                    placeholder="Industry (e.g. SaaS)" 
                    value={newCoIndustry}
                    onChange={(e) => setNewCoIndustry(e.target.value)}
                />
                <div className="flex gap-2">
                    <button onClick={handleCreateCompany} className="bg-purple-600 text-white px-4 py-2 rounded font-bold w-full">Save</button>
                    <button onClick={() => setIsCreating(false)} className="text-gray-500 px-4 py-2">Cancel</button>
                </div>
            </div>
        </div>
      )}

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
