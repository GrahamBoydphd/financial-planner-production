'use client';

import { useState, useEffect } from 'react';
import { api, Fund } from '@/lib/api';
import { X } from 'lucide-react';

interface MoveCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  currentFundId: string;
}

export default function MoveCompanyModal({ isOpen, onClose, onSuccess, companyId, currentFundId }: MoveCompanyModalProps) {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [selectedFundId, setSelectedFundId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.getFunds()
        .then((allFunds) => {
          // Filter out current fund
          const available = allFunds.filter(f => f.id !== currentFundId);
          setFunds(available);
          if (available.length > 0) {
            setSelectedFundId(available[0].id);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen, currentFundId]);

  const handleMove = async () => {
    if (!selectedFundId) return;
    try {
      setSubmitting(true);
      await api.moveCompany(companyId, selectedFundId);
      onSuccess();
      onClose();
    } catch (e) {
      console.error('Failed to move company:', e);
      alert('Failed to move company');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
        
        <h2 className="text-xl font-bold text-gray-900 mb-4">Move Company</h2>
        <p className="text-sm text-gray-500 mb-6">
          Select a destination fund for this company. All financial history will be preserved.
        </p>

        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading funds...</div>
        ) : funds.length === 0 ? (
          <div className="py-4 text-center text-red-500 text-sm">
            No other funds available. Create another fund first.
          </div>
        ) : (
          <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
            {funds.map(fund => (
              <label 
                key={fund.id} 
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedFundId === fund.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input 
                  type="radio" 
                  name="target_fund" 
                  value={fund.id}
                  checked={selectedFundId === fund.id}
                  onChange={(e) => setSelectedFundId(e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="ml-3">
                  <span className="block text-sm font-medium text-gray-900">{fund.fund_name}</span>
                  <span className="block text-xs text-gray-500">{fund.currency_code}</span>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleMove}
            disabled={submitting || funds.length === 0 || !selectedFundId}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Moving...' : 'Move Company'}
          </button>
        </div>
      </div>
    </div>
  );
}
