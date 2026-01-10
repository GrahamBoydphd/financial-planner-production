'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import FundForm from '@/components/forms/FundForm';
import CompanyForm from '@/components/forms/CompanyForm';
import { api, Company, Fund } from '@/lib/api';

export default function StructurePage() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const fetchData = async () => {
    try {
      const [f, c] = await Promise.all([api.getFunds(), api.getCompanies()]);
      setFunds(f);
      setCompanies(c);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Layout>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold">Portfolio Structure</h1>
        <p className="text-xs text-gray-400 font-mono">Note that multiple funds investing in multiple companies has not yet been implemented. Each company can be a member of one fund only, which is the best approach for systemic regenerative investing, where the investing fund is the holding company for all members of the system.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Funds Section */}
          <div className="space-y-4">
            <Card>
              <h2 className="text-xl font-bold mb-4">1. Create Fund</h2>
              <FundForm onSuccess={fetchData} />
            </Card>
            
            <div className="bg-white rounded shadow p-4">
              <h3 className="font-bold border-b pb-2 mb-2">Existing Funds</h3>
              {funds.length === 0 ? <p className="text-gray-500">No funds yet.</p> : (
                <ul className="space-y-2">
                  {funds.map(f => (
                    <li key={f.id} className="flex justify-between">
                      <span>{f.name}</span>
                      <span className="text-xs text-gray-400 font-mono">{f.id.slice(0,8)}...</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Companies Section */}
          <div className="space-y-4">
            <Card>
              <h2 className="text-xl font-bold mb-4">2. Create Company</h2>
              <CompanyForm onSuccess={fetchData} funds={funds} />
            </Card>

            <div className="bg-white rounded shadow p-4">
              <h3 className="font-bold border-b pb-2 mb-2">Existing Companies</h3>
              {companies.length === 0 ? <p className="text-gray-500">No companies yet.</p> : (
                <ul className="space-y-2">
                  {companies.map(c => (
                    <li key={c.id} className="flex justify-between">
                      <span>{c.name}</span>
                      <span className="text-xs text-gray-400 font-mono">{c.id.slice(0,8)}...</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
