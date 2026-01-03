'use client';

import { useState, useEffect } from 'react';
import { api, RevenueItem } from '@/lib/api';
import { ALPHA_OPTIONS, BETA_OPTIONS, SCALE_OPTIONS } from '@/lib/presets';
import Tooltip from '@/components/ui/Tooltip';

interface Props {
  planId: string;
  onSuccess: () => void;
  itemToEdit?: RevenueItem | null;
  onCancel?: () => void;
}

export default function RevenueForm({ planId, onSuccess, itemToEdit, onCancel }: Props) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('Sales');
  const [amount, setAmount] = useState('');
  const [growth, setGrowth] = useState('0');
  const [startMonth, setStartMonth] = useState('1');
  const [endMonth, setEndMonth] = useState('');
  const [freq, setFreq] = useState('Monthly');
  const [cogsPercent, setCogsPercent] = useState('');

  // Volatility
  const [volType, setVolType] = useState('none');
  const [volMin, setVolMin] = useState('');
  const [volMax, setVolMax] = useState('');
  const [volIntervals, setVolIntervals] = useState('');
  const [volMean, setVolMean] = useState('');
  const [volScale, setVolScale] = useState('');
  const [volFreedom, setVolFreedom] = useState('');
  const [volAlpha, setVolAlpha] = useState('');
  const [volBeta, setVolBeta] = useState('');

  // UI State for Simple/Advanced Mode
  const [isAdvanced, setIsAdvanced] = useState(false);

  // --- EFFECT: POPULATE FORM ON EDIT ---
  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.name);
      setSource(itemToEdit.source);
      setAmount(itemToEdit.initial_amount.toString());
      setGrowth(itemToEdit.growth_rate_percent.toString());
      setStartMonth(itemToEdit.start_month.toString());
      setEndMonth(itemToEdit.end_month ? itemToEdit.end_month.toString() : '');
      setFreq(itemToEdit.frequency);
      setCogsPercent(itemToEdit.cost_of_revenue_percent ? itemToEdit.cost_of_revenue_percent.toString() : '');
      
      const vType = itemToEdit.volatility_type || 'none';
      setVolType(vType);
      setVolMin(itemToEdit.vol_min ? itemToEdit.vol_min.toString() : '');
      setVolMax(itemToEdit.vol_max ? itemToEdit.vol_max.toString() : '');
      setVolIntervals(itemToEdit.vol_intervals ? itemToEdit.vol_intervals.toString() : '');
      setVolMean(itemToEdit.vol_mean ? itemToEdit.vol_mean.toString() : '');
      setVolScale(itemToEdit.vol_scale ? itemToEdit.vol_scale.toString() : '');
      setVolFreedom(itemToEdit.vol_freedom ? itemToEdit.vol_freedom.toString() : '');
      setVolAlpha(itemToEdit.vol_alpha ? itemToEdit.vol_alpha.toString() : '');
      setVolBeta(itemToEdit.vol_beta ? itemToEdit.vol_beta.toString() : '');

      // Default to Simple Mode
    } else {
      clearForm();
    }
  }, [itemToEdit]);

  const clearForm = () => {
    setName('');
    setSource('Sales');
    setAmount('');
    setGrowth('0');
    setStartMonth('1');
    setEndMonth('');
    setFreq('Monthly');
    setCogsPercent('');
    setVolType('none');
    setVolMin(''); setVolMax(''); setVolIntervals('');
    setVolMean(''); setVolScale(''); setVolFreedom(''); setVolAlpha(''); setVolBeta('');
    setIsAdvanced(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount) return;

    const payload = {
      plan_id: planId,
      name,
      source,
      initial_amount: Number(amount),
      growth_rate_percent: Number(growth),
      start_month: Number(startMonth),
      end_month: endMonth ? Number(endMonth) : undefined,
      frequency: freq,
      cost_of_revenue_percent: cogsPercent ? Number(cogsPercent) : undefined,
      
      volatility_type: volType !== 'none' ? volType as any : undefined,
      vol_min: volType === 'flat' && volMin ? Number(volMin) : undefined,
      vol_max: volType === 'flat' && volMax ? Number(volMax) : undefined,
      vol_intervals: volType === 'flat' && volIntervals ? Number(volIntervals) : undefined,
      vol_mean: volMean ? Number(volMean) : undefined,
      vol_scale: (volType === 'nrig' || volType === 'student_t') && volScale ? Number(volScale) : undefined,
      vol_freedom: volType === 'student_t' && volFreedom ? Number(volFreedom) : undefined,
      vol_alpha: volType === 'nrig' && volAlpha ? Number(volAlpha) : undefined,
      vol_beta: volType === 'nrig' && volBeta ? Number(volBeta) : undefined,
    };

    if (itemToEdit) {
      await api.updateRevenueItem(itemToEdit.id, payload);
    } else {
      await api.createRevenueItem(payload);
    }

    clearForm();
    onSuccess(); 
  };

  // Helper to find description
  const getAlphaDesc = () => ALPHA_OPTIONS.find(o => o.value.toString() === volAlpha)?.description;
  const getBetaDesc = () => BETA_OPTIONS.find(o => o.value.toString() === volBeta)?.description;
  const getScaleDesc = () => SCALE_OPTIONS.find(o => o.value.toString() === volScale)?.description;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-4 rounded border">
      <div className="flex justify-between items-center mb-2">
         <h3 className="font-bold text-gray-700">{itemToEdit ? 'Edit Revenue Stream' : 'Add Revenue Stream'}</h3>
         {itemToEdit && (
            <button type="button" onClick={onCancel} className="text-xs text-red-500 underline">Cancel Edit</button>
         )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500">Name</label>
          <input className="w-full border p-2 rounded text-sm" placeholder="e.g. SaaS Subs" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Source Type</label>
          <select className="w-full border p-2 rounded text-sm" value={source} onChange={e => setSource(e.target.value)}>
            <option>Sales</option>
            <option>Subscription</option>
            <option>Service</option>
            <option>Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500">Initial Amount ($)</label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Growth Rate (%/mo)</label>
          <input type="number" step="0.1" className="w-full border p-2 rounded text-sm" value={growth} onChange={e => setGrowth(e.target.value)} />
        </div>
        <div>
            <label className="text-xs text-gray-500">Cost of Rev (%)</label>
            <input type="number" className="w-full border p-2 rounded text-sm" placeholder="Optional" value={cogsPercent} onChange={e => setCogsPercent(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500">Frequency</label>
          <select className="w-full border p-2 rounded text-sm" value={freq} onChange={e => setFreq(e.target.value)}>
            <option>Monthly</option>
            <option>One-time</option>
            <option>Quarterly</option>
            <option>Annually</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Start Month</label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={startMonth} onChange={e => setStartMonth(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">End Month (Opt)</label>
          <input type="number" className="w-full border p-2 rounded text-sm" value={endMonth} onChange={e => setEndMonth(e.target.value)} />
        </div>
      </div>

      {/* VOLATILITY SECTION */}
      <div className="border-t pt-2 mt-2">
        <div className="flex justify-between items-center mb-1">
             <label className="text-xs font-bold text-gray-700">Uncertainty / Risk Model</label>
             {volType !== 'none' && (
                 <button type="button" onClick={() => setIsAdvanced(!isAdvanced)} className="text-xs text-blue-600 underline">
                     {isAdvanced ? 'Switch to Simple Mode' : 'Switch to Advanced Mode'}
                 </button>
             )}
        </div>
        <div className="space-y-2">
            <div>
                <label className="text-xs text-gray-500">Model Type</label>
                <select className="w-full border p-1 rounded text-xs" value={volType} onChange={e => setVolType(e.target.value)}>
                    <option value="none">Just the averages</option>
                    <option value="flat">Simple volatility (min/max)</option>
                    <option value="nrig">Comprehensive volatility</option>
                    <option value="student_t">Student's t distribution</option>
                </select>
            </div>
            
            {volType !== 'none' && (
              <div className="bg-gray-100 p-2 rounded">
                 
                 {/* SIMPLE MODE DROPDOWNS (NRIG Only) */}
                 {!isAdvanced && volType === 'nrig' && (
                     <div className="space-y-3">
                         <div className="text-xs text-gray-600 italic mb-2">
                            Tier 1: Configure the shape of uncertainty.
                         </div>
                         <div>
                             <label className="text-xs text-gray-500 flex items-center gap-1">
                                Likelyhood of outliers (tail weight)
                                <Tooltip content="Controls how often extreme events (white and black swans) occur." />
                             </label>
                             <select className="w-full border p-1 rounded text-xs" value={volAlpha} onChange={e => setVolAlpha(e.target.value)}>
                                 <option value="">-- Select --</option>
                                 {ALPHA_OPTIONS.map(o => (
                                     <option key={o.value} value={o.value}>{o.label} </option>
                                 ))}
                             </select>
                             <p className="text-xs text-gray-400 italic mt-1">{getAlphaDesc()}</p>
                         </div>

                         <div>
                             <label className="text-xs text-gray-500 flex items-center gap-1">
                                Volatility imbalance (downside / upside)
                                <Tooltip content="Skewness: Are surprises more likely to be positive or negative?" />
                             </label>
                             <select className="w-full border p-1 rounded text-xs" value={volBeta} onChange={e => setVolBeta(e.target.value)}>
                                 <option value="">-- Select --</option>
                                 {BETA_OPTIONS.map(o => (
                                     <option key={o.value} value={o.value}>{o.label}</option>
                                 ))}
                             </select>
                             <p className="text-xs text-gray-400 italic mt-1">{getBetaDesc()}</p>
                         </div>

                         <div>
                             <label className="text-xs text-gray-500 block">Delta/Scale (Volatility)</label>
                             <select className="w-full border p-1 rounded text-xs" value={volScale} onChange={e => setVolScale(e.target.value)}>
                                 <option value="">-- Select --</option>
                                 {SCALE_OPTIONS.map(o => (
                                     <option key={o.value} value={o.value}>{o.label}</option>
                                 ))}
                             </select>
                             <p className="text-xs text-gray-400 italic mt-1">{getScaleDesc()}</p>
                         </div>
                     </div>
                 )}

                 {/* ADVANCED INPUTS OR OTHER MODELS */}
                 {(isAdvanced || volType !== 'nrig') && (
                     <div className="grid grid-cols-3 gap-2">
                         {/* Common Mean */}
                         <div className="col-span-3">
                             <label className="text-xs text-gray-400">Mean / Drift (Optional Override)</label>
                             <input placeholder="Default = Growth Rate" className="w-full border p-1 text-xs" value={volMean} onChange={e => setVolMean(e.target.value)} />
                         </div>

                         {/* Flat Params */}
                         {volType === 'flat' && (
                            <>
                                <div className="col-span-3 flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-gray-500">Range Settings</span>
                                    <Tooltip content="Define a hard minimum and maximum percentage deviation." />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Min %</label>
                                    <input className="w-full border p-1 text-xs" value={volMin} onChange={e => setVolMin(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Max %</label>
                                    <input className="w-full border p-1 text-xs" value={volMax} onChange={e => setVolMax(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Steps</label>
                                    <input className="w-full border p-1 text-xs" value={volIntervals} onChange={e => setVolIntervals(e.target.value)} />
                                </div>
                            </>
                         )}

                         {/* Student-T Params */}
                         {volType === 'student_t' && (
                            <>
                                <div>
                                    <label className="text-xs text-gray-400">Scale (Vol)</label>
                                    <input className="w-full border p-1 text-xs" value={volScale} onChange={e => setVolScale(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Freedom (Deg)</label>
                                    <input className="w-full border p-1 text-xs" value={volFreedom} onChange={e => setVolFreedom(e.target.value)} />
                                </div>
                            </>
                         )}

                         {/* NRIG Params (Advanced) */}
                         {volType === 'nrig' && (
                            <>
                                <div>
                                    <label className="text-xs text-gray-400">Likelyhood of outliers (Alpha)</label>
                                    <input className="w-full border p-1 text-xs" value={volAlpha} onChange={e => setVolAlpha(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Imbalance (Beta)</label>
                                    <input className="w-full border p-1 text-xs" value={volBeta} onChange={e => setVolBeta(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400">Delta (Scale)</label>
                                    <input className="w-full border p-1 text-xs" value={volScale} onChange={e => setVolScale(e.target.value)} />
                                </div>
                            </>
                         )}
                     </div>
                 )}
              </div>
            )}
        </div>
      </div>

      <button className={`w-full text-white p-2 rounded font-bold ${itemToEdit ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
        {itemToEdit ? 'Update Stream' : 'Add Stream'}
      </button>
    </form>
  );
}
