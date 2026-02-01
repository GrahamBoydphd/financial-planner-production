'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Building2, 
  Wallet, 
  Briefcase, 
  Landmark, 
  PieChart, 
  Zap 
} from 'lucide-react';
import api from '@/lib/api';
import { Card } from '@/components/ui/card';
import EventList from '@/components/EventList';

export default function ClientPage({ params }: { params: { planId: string } }) {
  const [activeTab, setActiveTab] = useState('revenue');
  const [plan, setPlan] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const planData = await api.getPlan(params.planId);
        setPlan(planData);
        
        if (planData?.company_id) {
          const companyData = await api.getCompany(planData.company_id);
          setCompany(companyData);
        }
      } catch (error) {
        console.error('Error loading plan inputs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [params.planId]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading plan configuration...</div>;
  if (!plan || !company) return <div className="p-8 text-center text-red-500">Error loading plan data</div>;

  const TABS = [
    { id: 'revenue', label: 'Revenue', icon: TrendingUp },
    { id: 'expenses', label: 'Expenses', icon: DollarSign },
    { id: 'staffing', label: 'Staffing', icon: Users },
    { id: 'assets', label: 'Assets', icon: Building2 },
    { id: 'liabilities', label: 'Liabilities', icon: Wallet },
    { id: 'equity', label: 'Equity', icon: Briefcase },
    { id: 'treasury', label: 'Treasury', icon: Landmark },
    { id: 'valuation', label: 'Valuation', icon: PieChart },
    { id: 'events', label: 'Swan Events', icon: Zap },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{plan.name} Inputs</h1>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium transition-colors
                  ${isActive 
                    ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-300'}
                `}
              >
                <Icon className={`-ml-0.5 mr-2 h-4 w-4 ${isActive ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 group-hover:text-gray-500'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'events' ? (
          <div className='space-y-6 animate-fade-in'>
            <Card className='p-0 overflow-hidden'>
              <EventList 
                fundId={null}
                companies={[company]} 
                funds={[]} 
                companyId={company.id}
              />
            </Card>
          </div>
        ) : (
          <div className="p-12 text-center border-2 border-dashed rounded-lg text-gray-400">
            {TABS.find(t => t.id === activeTab)?.label} Configuration Placeholder
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Helper to format growth rates for display.
 * Logic:
 * - If >= 1 (e.g. 5%), show 2 decimals (5.00).
 * - If < 1 (e.g. 0.05%), show 3 significant digits (0.05).
 */
export const fmtRate = (val: string | number) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return val;
  if (Math.abs(num) >= 1) return num.toFixed(2); 
  return parseFloat(num.toPrecision(3)).toString(); 
};
