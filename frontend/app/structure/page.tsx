'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Edit2, Trash2, Eye, Copy, Loader2 } from 'lucide-react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import FundForm from '@/components/forms/FundForm';
import CompanyForm from '@/components/forms/CompanyForm';
import EventList from '@/components/EventList';
import { api, Company, Fund } from '@/lib/api';

export default function StructurePage() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  
  // Edit State
  const [editingFund, setEditingFund] = useState<Fund | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  
  // Loading State for Operations
  const [loadingOp, setLoadingOp] = useState<string | null>(null);

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

  const handleDuplicateFund = async (id: string) => {
    if (loadingOp) return;
    if (!confirm("Duplicate this fund?")) return;
    setLoadingOp(id);
    try {
        await api.duplicateFund(id);
        await fetchData();
    } catch (e) {
        console.error("Failed to duplicate fund", e);
        alert("Failed to duplicate fund.");
    } finally {
        setLoadingOp(null);
    }
  };

  const handleDuplicateCompany = async (id: string) => {
    if (loadingOp) return;
    if (!confirm("Duplicate this company?")) return;
    setLoadingOp(id);
    try {
        await api.duplicateCompany(id);
        await fetchData();
    } catch (e) {
        console.error("Failed to duplicate company", e);
        alert("Failed to duplicate company.");
    } finally {
        setLoadingOp(null);
    }
  };

  const handleDeleteFund = async (id: string) => {
    if (loadingOp) return;
    if (!confirm("Are you sure you want to delete this fund? This action cannot be undone.")) return;
    setLoadingOp(id);
    try {
        await api.deleteFund(id); 
        await fetchData();
    } catch (e) {
        console.error("Failed to delete fund", e);
        alert("Failed to delete fund.");
    } finally {
        setLoadingOp(null);
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (loadingOp) return;
    if (!confirm("Are you sure you want to delete this company? This action cannot be undone.")) return;
    setLoadingOp(id);
    try {
        await api.deleteCompany(id);
        await fetchData();
    } catch (e) {
        console.error("Failed to delete company", e);
        alert("Failed to delete company.");
    } finally {
        setLoadingOp(null);
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-lg">
            <h1 className="text-3xl font-bold text-indigo-900 mb-2">Portfolio Structure</h1>
            <p className="text-indigo-700 mb-4">
                Define the hierarchy of your financial simulation. Create <strong>Funds</strong> to act as holding entities and <strong>Companies</strong> to model specific business ventures.
            </p>
            <div className="text-xs text-indigo-500 font-mono space-y-1">
                <p>This is an alpha release for early developmental testing, feedback, and educational purposes only.</p>
                <p>Note: Each company can currently be a member of one fund only.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Funds Section */}
          <div className="space-y-4">
            <Card>
              <h2 className="text-xl font-bold mb-4">
                {editingFund ? 'Edit Fund' : '1. Create Fund'}
              </h2>
              <FundForm 
                initialData={editingFund}
                onSuccess={() => { fetchData(); setEditingFund(null); }} 
                onCancel={() => setEditingFund(null)}
              />
            </Card>

            <div className="bg-white rounded shadow p-4">
              <h3 className="font-bold border-b pb-2 mb-2">Existing Funds</h3>
              {funds.length === 0 ? <p className="text-gray-500">No funds yet.</p> : (
                <div className="space-y-2">
                  {funds.map(f => (
                    <div key={f.id} className="block group rounded p-2 -mx-2 transition-colors hover:bg-gray-50">
                        <div className="flex justify-between items-center">
                            <Link href={`/fund/${f.id}`} className="flex-grow">
                                <span className="font-medium text-gray-900 group-hover:text-blue-600">{f.fund_name}</span>
                                <span className="text-xs text-gray-400 font-mono ml-2">{f.id.slice(0,8)}...</span>
                            </Link>
                            <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity items-center">
                                {loadingOp === f.id ? (
                                    <Loader2 className="animate-spin text-indigo-600" size={16} />
                                ) : (
                                    <>
                                        <button 
                                            onClick={(e) => { 
                                              e.preventDefault(); 
                                              handleDuplicateFund(f.id);
                                            }} 
                                            className="p-1 text-gray-400 hover:text-indigo-600"
                                            title="Duplicate Fund"
                                            disabled={!!loadingOp}
                                        >
                                            <Copy size={16} />
                                        </button>
                                        <button 
                                            onClick={(e) => { 
                                              e.preventDefault(); 
                                              setEditingFund(f);
                                            }} 
                                            className="p-1 text-gray-400 hover:text-blue-600"
                                            title="Edit Fund"
                                            disabled={!!loadingOp}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.preventDefault(); handleDeleteFund(f.id); }} 
                                            className="p-1 text-gray-400 hover:text-red-600"
                                            title="Delete Fund"
                                            disabled={!!loadingOp}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Event List (Moved below Existing Funds) */}
            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
              <EventList 
                fundId={null} 
                companies={companies} 
                funds={funds}
              />
            </div>
          </div>

          {/* Companies Section */}
          <div className="space-y-4">
            <Card id="add-company" className="scroll-mt-24">
              <h2 className="text-xl font-bold mb-4">
                {editingCompany ? 'Edit Company' : '2. Create Company'}
              </h2>
              <CompanyForm 
                initialData={editingCompany}
                funds={funds} 
                onSuccess={() => { fetchData(); setEditingCompany(null); }} 
                onCancel={() => setEditingCompany(null)}
              />
            </Card>

            <div className="bg-white rounded shadow p-4">
              <div className="flex justify-between items-center border-b pb-2 mb-2">
                  <h3 className="font-bold">Existing Companies</h3>
                  <Link href="/" className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded">
                    <Eye size={12} /> View Dashboard
                  </Link>
              </div>
              
              {companies.length === 0 ? <p className="text-gray-500">No companies yet.</p> : (
                <div className="space-y-2">
                  {companies.map(c => (
                    <Link href={`/company/${c.id}`} key={c.id} className="block group hover:bg-gray-50 rounded p-2 -mx-2 transition-colors">
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="font-medium text-gray-900 group-hover:text-blue-600">{c.company_name}</span>
                                <span className="text-gray-400 text-sm ml-2">[{c.currency_code}]</span>
                                <span className="text-xs text-gray-400 font-mono ml-2">{c.id.slice(0,8)}...</span>
                            </div>
                            <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity items-center">
                                {loadingOp === c.id ? (
                                    <Loader2 className="animate-spin text-indigo-600" size={16} />
                                ) : (
                                    <>
                                        <button 
                                            onClick={(e) => { 
                                              e.preventDefault(); 
                                              handleDuplicateCompany(c.id);
                                            }} 
                                            className="p-1 text-gray-400 hover:text-indigo-600"
                                            title="Duplicate Company"
                                            disabled={!!loadingOp}
                                        >
                                            <Copy size={16} />
                                        </button>
                                        <button 
                                            onClick={(e) => { 
                                              e.preventDefault(); 
                                              setEditingCompany(c);
                                              document.getElementById('add-company')?.scrollIntoView({ behavior: 'smooth' });
                                            }} 
                                            className="p-1 text-gray-400 hover:text-blue-600"
                                            title="Edit Company"
                                            disabled={!!loadingOp}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.preventDefault(); handleDeleteCompany(c.id); }} 
                                            className="p-1 text-gray-400 hover:text-red-600"
                                            title="Delete Company"
                                            disabled={!!loadingOp}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
