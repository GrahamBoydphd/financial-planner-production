import React, { useEffect, useState } from 'react';
import { api, SwanEvent, Company, Fund } from '@/lib/api';
import { Plus, Edit2, Zap, Clock, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import EventForm from './forms/EventForm';
import DeleteButton from '@/components/ui/DeleteButton';

interface EventListProps {
  fundId: string | null;
  companyId?: string;
  fundName?: string;
  companies: Company[];
  funds: Fund[];
}

export default function EventList({ fundId, companyId, fundName, companies, funds }: EventListProps) {
  const [events, setEvents] = useState<SwanEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SwanEvent | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      // Gather ALL IDs to fetch based on the current scope (passed via props)
      // This ensures we get events for funds AND companies in the current view
      const allIds = [
        ...funds.map(f => f.id),
        ...companies.map(c => c.id)
      ];

      const data = await api.getEvents(allIds);
      setEvents(data);
    } catch (error) {
      console.error("Failed to fetch events", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    setIsCreating(false);
    setEditingEvent(null);
  }, [fundId, companyId, funds, companies]);

  const handleDelete = async (id: string) => {
    // Confirmation is now handled by DeleteButton
    try {
      await api.deleteEvent(id);
      fetchEvents();
    } catch (error) {
      console.error("Failed to delete event", error);
    }
  };

  // --- BADGE HELPERS ---

  const getDirectionBadge = (direction: string) => {
    switch (direction) {
      case 'detrimental_only':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><TrendingDown size={12} className="mr-1"/> Detrimental</span>;
      case 'beneficial_only':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><TrendingUp size={12} className="mr-1"/> Beneficial</span>;
      case 'both_neutral':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"><Minus size={12} className="mr-1"/> Neutral</span>;
      case 'both_biased_detrimental':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800"><TrendingDown size={12} className="mr-1"/> Biased Loss</span>;
      case 'both_biased_beneficial':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800"><TrendingUp size={12} className="mr-1"/> Biased Gain</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{direction}</span>;
    }
  };

  const getDurationLabel = (months: string) => {
    const m = parseInt(months);
    if (m <= 4) return 'Short';
    if (m <= 8) return 'Medium';
    return 'Long';
  };

  return (
    <div className="bg-white rounded shadow border border-amber-100 overflow-hidden">
      <div className="bg-amber-50 px-4 py-3 border-b border-amber-100 flex justify-between items-center">
        <div className="flex items-center gap-2 text-amber-900">
          <Zap size={18} className="text-amber-600" />
          <h3 className="font-bold">{fundName ? 'Active Swan Events (Events can occur simultaneously)' : 'Active Portfolio Swan Events (Events can occur simultaneously)'}</h3>
          {fundName && (
            <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
              {fundName}
            </span>
          )}
        </div>
        {!isCreating && !editingEvent && (
          <button
            onClick={() => setIsCreating(true)}
            className="text-xs flex items-center gap-1 bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 px-2 py-1 rounded shadow-sm transition-colors"
          >
            <Plus size={14} /> Add Event
          </button>
        )}
      </div>

      <div className="p-4">
        {isCreating || editingEvent ? (
          <EventForm
            fundId={fundId || ''}
            funds={funds}
            companies={companies}
            initialData={editingEvent}
            onSuccess={() => {
              setIsCreating(false);
              setEditingEvent(null);
              fetchEvents();
            }}
            onCancel={() => {
              setIsCreating(false);
              setEditingEvent(null);
            }}
          />
        ) : (
          <>
            {loading ? (
              <div className="text-center py-4 text-gray-400 text-sm">Loading events...</div>
            ) : events.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded">
                No Swan Events configured{fundName ? ' for this fund' : ''}.
              </div>
            ) : (
              <div className="space-y-3">
                {[...events].sort((a, b) => (a.scope === 'global' ? -1 : 1)).map((evt) => (
                  <div key={evt.id} className="border rounded-lg p-3 hover:shadow-sm transition-shadow bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${evt.scope === 'global' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                            {evt.scope === 'global' ? 'Global' : 'Local'}
                          </span>
                          <h4 className="font-medium text-gray-900">{evt.event_name}</h4>
                          {getDirectionBadge(evt.direction)}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 mt-2">
                          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-100">
                            <Activity size={12} className="text-indigo-500" />
                            <span>Prob: <span className="font-semibold text-indigo-700">{parseFloat(evt.occurrence_probability || '0').toFixed(1)}%</span></span>
                          </div>
                          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-100">
                            <Zap size={12} className="text-amber-500" />
                            <span>Mag: <span className="font-semibold text-amber-700">{evt.magnitude || 'unknown'}x</span></span>
                          </div>
                          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-100">
                            <Clock size={12} className="text-blue-500" />
                            <span>Dur: <span className="font-semibold text-blue-700">{evt.duration || '0'}m ({getDurationLabel(evt.duration || '0')})</span></span>
                          </div>
                          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-100">
                            <span className="text-gray-400">Type:</span>
                            <span className="font-medium">{(evt.event_type || 'unknown_type').replace('_', ' ')}</span>
                          </div>
                        </div>

                        <div className="mt-2 text-xs">
                          {evt.scope === 'local' && (
                            <p className="text-blue-600 flex items-center gap-1">
                              <span className="font-semibold">Target:</span> 
                              {companies.find(c => evt.target_ids.includes(c.id))?.company_name || 'Unknown Company'}
                            </p>
                          )}
                          {evt.scope === 'global' && (
                            <p className="text-purple-600 flex items-center gap-1">
                              <span className="font-semibold">Targets:</span> 
                              {evt.target_ids.length} Funds
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-1 ml-4 items-center">
                        <button
                          onClick={() => setEditingEvent(evt)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit Event"
                        >
                          <Edit2 size={14} />
                        </button>
                        <DeleteButton onDelete={() => handleDelete(evt.id)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
