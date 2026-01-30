import React, { useEffect, useState } from 'react';
import { api, Shock, Company } from '@/lib/api';
import { Plus, Edit2, Trash2, Zap, AlertTriangle } from 'lucide-react';
import ShockForm from './forms/ShockForm';

interface ShockListProps {
  fundId: string | null;
  companies: Company[];
  fundName?: string;
}

export default function ShockList({ fundId, companies, fundName }: ShockListProps) {
  const [shocks, setShocks] = useState<Shock[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingShock, setEditingShock] = useState<Shock | null>(null);

  const fetchShocks = async () => {
    if (!fundId) return;
    setLoading(true);
    try {
      const data = await api.getShocks(fundId);
      setShocks(data);
    } catch (error) {
      console.error("Failed to fetch shocks", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fundId) {
      fetchShocks();
    } else {
      setShocks([]);
    }
  }, [fundId]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shock?")) return;
    try {
      await api.deleteShock(id);
      fetchShocks();
    } catch (error) {
      console.error("Failed to delete shock", error);
    }
  };

  const getDirectionBadgeColor = (direction: string) => {
    switch (direction?.toLowerCase()) {
      case 'detrimental_only': return 'bg-red-100 text-red-800';
      case 'beneficial_only': return 'bg-green-100 text-green-800';
      case 'both_neutral': return 'bg-purple-100 text-purple-800';
      case 'both_detrimental': return 'bg-orange-100 text-orange-800';
      case 'both_beneficial': return 'bg-teal-100 text-teal-800';
      // Fallback for legacy data
      case 'detrimental': return 'bg-red-100 text-red-800';
      case 'beneficial': return 'bg-green-100 text-green-800';
      case 'both': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDurationLabel = (duration: string) => {
    switch (duration?.toLowerCase()) {
      case 'short': return 'Short (1-4m)';
      case 'medium': return 'Medium (4-8m)';
      case 'long': return 'Long (8-24m)';
      default: return duration || 'Short';
    }
  };

  if (!fundId) {
    return (
      <div className="bg-white rounded shadow p-4 border-l-4 border-gray-300">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-400 flex items-center gap-2">
            <Zap className="text-gray-300" size={20} />
            Economic Shocks
          </h3>
        </div>
        <div className="text-center py-6 bg-gray-50 rounded border border-gray-100 text-gray-500 text-sm">
          Select a fund from the list above (<Zap size={14} className="inline" /> icon) to define economic shocks.
        </div>
      </div>
    );
  }

  if (isCreating || editingShock) {
    return (
      <div className="bg-white rounded shadow p-4 border-l-4 border-amber-500">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Zap className="text-amber-500" size={20} />
            {editingShock ? 'Edit Shock' : 'Create New Shock'}
          </h3>
        </div>
        <ShockForm
          fundId={fundId}
          companies={companies}
          initialData={editingShock}
          onSuccess={() => {
            setIsCreating(false);
            setEditingShock(null);
            fetchShocks();
          }}
          onCancel={() => {
            setIsCreating(false);
            setEditingShock(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded shadow p-4 border-l-4 border-amber-500">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Zap className="text-amber-500" size={20} />
          {fundName ? `Active Shocks for ${fundName}` : 'Active Shocks'}
        </h3>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded transition-colors"
        >
          <Plus size={14} /> Add Shock
        </button>
      </div>

      {loading ? (
        <div className="text-center py-4 text-gray-500">Loading shocks...</div>
      ) : shocks.length === 0 ? (
        <div className="text-center py-6 bg-amber-50 rounded border border-amber-100 text-amber-800 text-sm">
          <AlertTriangle className="mx-auto mb-2 opacity-50" size={24} />
          No shocks defined for this fund.
        </div>
      ) : (
        <div className="space-y-2">
          {shocks.map(shock => (
            <div key={shock.id} className="flex justify-between items-center p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors border border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{shock.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${shock.scope === 'global' ? 'bg-indigo-100 text-indigo-800' : 'bg-green-100 text-green-800'}`}>
                    {shock.scope === 'global' ? 'Global' : 'Local'}
                  </span>
                  <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full flex items-center gap-1 text-xs font-medium border border-yellow-200">
                    ⚡ {shock.occurrence_probability}% / yr
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1 flex gap-2 items-center flex-wrap">
                  <span>{shock.shock_type}</span>
                  <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full capitalize">{shock.magnitude}</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">{getDurationLabel(shock.duration)}</span>
                  <span className={`${getDirectionBadgeColor(shock.direction)} px-2 py-0.5 rounded-full capitalize`}>
                    {shock.direction?.replace('_', ' ')}
                  </span>
                  <span>{shock.volatility_type !== 'none' ? `Probabilistic (${shock.volatility_type})` : 'Deterministic'}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingShock(shock)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="Edit"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(shock.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
