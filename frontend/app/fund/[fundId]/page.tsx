'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import { api, Fund, Company, FundPlan } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Edit2, ArrowRight, Plus } from 'lucide-react';

export default function FundPage({ params }: { params: { fundId: string } }) {
  const { fundId } = params;
  const [fund, setFund] = useState<Fund | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<FundPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch fund details, all companies (to filter), and fund plans
      const [fundData, allCompanies, fundPlans] = await Promise.all([
        api.getFund(fundId),
        api.getCompanies(),
        api.getFundPlans(fundId)
      ]);
      
      setFund(fundData);
      // Filter companies belonging to this fund
      setCompanies(allCompanies.filter(c => c.fund_id === fundId));
      setPlans(fundPlans);
    } catch (e) {
      console.error('Failed to load fund data:', e);
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
      {/* Breadcrumb Navigation */}
      <nav className='mb-6'>
        <Link 
          href='/' 
          className='text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium transition-colors'
        >
          <ArrowLeft className='h-4 w-4' />
          Back to Dashboard
        </Link>
      </nav>

      {/* Fund Header */}
      <div className="mb-10 border-b border-gray-200 pb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{fund.fund_name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide">
                {fund.currency_code}
              </span>
              <span className="text-sm text-gray-500">ID: {fund.id}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Fund Scenarios */}
      <section className="mb-12">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-500" />
              Fund Scenarios
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Manage simulation configurations and view Monte Carlo results.
            </p>
          </div>
          <Link 
            href={`/fund/${fundId}/inputs`}
            className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create Scenario
          </Link>
        </div>

        {plans.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <BarChart3 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900">No Scenarios Defined</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              Create a simulation scenario to project fund performance.
            </p>
            <Link 
              href={`/fund/${fundId}/inputs`}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline"
            >
              Create First Scenario &rarr;
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map(plan => (
              <Card key={plan.id} className="flex flex-col justify-between h-full hover:shadow-md transition-shadow border-t-4 border-t-blue-500">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 line-clamp-1" title={plan.plan_name}>
                    {plan.plan_name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Created: {plan.created_at ? new Date(plan.created_at).toLocaleDateString() : 'Date N/A'}
                  </p>
                </div>
                
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                  <Link 
                    href={`/fund/${fundId}/inputs?plan_id=${plan.id}`}
                    className="flex-1 flex items-center justify-center gap-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 py-2 rounded transition-colors border border-gray-200"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit Config
                  </Link>
                  <Link 
                    href={`/fund/${fundId}/results?fund_plan_id=${plan.id}`}
                    className="flex-1 flex items-center justify-center gap-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 py-2 rounded transition-colors shadow-sm"
                  >
                    <BarChart3 className="h-3 w-3" />
                    View Results
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Portfolio Companies */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Portfolio Companies</h2>
            <p className="text-sm text-gray-500 mt-1">
              Entities managed under this fund.
            </p>
          </div>
          <Link 
            href="/structure#add-company"
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2 px-4 rounded-md transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Company
          </Link>
        </div>

        {companies.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <h3 className="text-sm font-medium text-gray-900">No Companies Yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Add your first portfolio company to start modeling.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map(co => (
              <Link key={co.id} href={`/company/${co.id}`} className="group">
                <Card className="h-full hover:border-blue-400 transition-colors group-hover:shadow-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {co.company_name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">{co.industry || 'General'}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                      {co.currency_code}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
