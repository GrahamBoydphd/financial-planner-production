🧠 'Thinking' mode activated for gemini-3.5-flash...
<file path='frontend/components/forms/CapitalForm.tsx'>'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import Tooltip from '@/components/ui/Tooltip';

interface Props {
  planId: string;
  onSuccess: () => void;
  currencySymbol?: string;
}

interface FormErrors {
  name?: string;
  amount?: string;
  month?: string;
}

export default function CapitalForm({ planId, onSuccess, currencySymbol = '$' }: Props) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState('');
  const [offset, setOffset] = useState('');
  const [anchorMonth, setAnchorMonth] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Query or determine the absolute month of the first investment on record (the minimum month across active injections)
  useEffect(() => {
    let isMounted = true;
    const fetchAnchor = async () => {
      try {
        let injections: any[] = [];
        // Robust check for API methods to prevent runtime crashes
        if (typeof (api as any).getCapitalInjections === 'function') {
          injections = await (api as any).getCapitalInjections(planId);
        } else if (typeof (api as any).getPlan === 'function') {
          const plan = await (api as any).getPlan(planId);
          injections = plan.capital_injections || plan.capitalInjections || [];
        } else if (typeof (api as any).get === 'function') {
          const res = await (api as any).get(`/api/plans/${planId}`);
          injections = res.data?.capital_injections || [];
        }

        if (isMounted && Array.isArray(injections) && injections.length > 0) {
          const validMonths = injections
            .map((inj: any) => parseInt(inj.month, 10))
            .filter((m: number) => !isNaN(m));
          if (validMonths.length > 0) {
            const minMonth = Math.min(...validMonths);
            setAnchorMonth(minMonth);
            
            // Initialize local offset if month is already set
            if (month) {
              const mVal = parseInt(month, 10);
              if (!isNaN(mVal)) {
                setOffset((mVal - minMonth).toString());
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch anchor month:", err);
      }
    };

    fetchAnchor();
    return () => {
      isMounted = false;
    };
  }, [planId]);

  // Bidirectional Sync: Absolute Month Input Changes
  const handleMonthChange = (val: string) => {
    setMonth(val);
    if (errors.month) setErrors({ ...errors, month: undefined });

    if (val === '') {
      setOffset('');
      return;
    }

    const parsedMonth = parseInt(val, 10);
    if (!isNaN(parsedMonth)) {
      setOffset((parsedMonth - anchorMonth).toString());
    } else {
      setOffset('');
    }
  };

  // Bidirectional Sync: Relative Offset Input Changes
  const handleOffsetChange = (val: string) => {
    setOffset(val);

    if (val === '') {
      setMonth('');
      return;
    }

    const parsedOffset = parseInt(val, 10);
    if (!isNaN(parsedOffset)) {
      const calculatedMonth = anchorMonth + parsedOffset;
      setMonth(calculatedMonth.toString());
      if (errors.month) setErrors({ ...errors, month: undefined });
    } else {
      setMonth('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors: FormErrors = {};
    if (!name.trim()) newErrors.name = 'Source Name is required';
    if (!amount) newErrors.amount = 'Amount is required';
    
    // Validation: Allow month 0, but require presence and non-negative
    if (!month) {
      newErrors.month = 'Month is required';
    } else if (parseInt(month, 10) < 0) {
      newErrors.month = 'Month cannot be negative';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Clear errors and submit
    setErrors({});
    setIsSubmitting(true);
    
    try {
      // Force 2 decimal places for Rust strictness
      const formattedAmount = parseFloat(amount).toFixed(2);

      // Isolate API Payload Boundaries: Forward only the final calculated absolute month integer
      const payload = {
        plan_id: planId,
        injection_name: name,
        amount: formattedAmount,
        month: parseInt(month, 10)
      };

      console.log("Submitting Capital:", payload);

      await api.createCapitalInjection(payload);

      // Reset form on success
      setName('');
      setAmount('');
      setMonth('');
      setOffset('');
      onSuccess();
    } catch (error: any) {
      console.error("Failed to add capital injection", error);
      alert(JSON.stringify(error.response?.data || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-gray-800 text-sm">Add New Injection</h3>
        <span className="text-xs text-gray-400">Fixed Amount</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Name Input */}
        <div className="md:col-span-7">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Source Name <span className="text-red-500">*</span></label>
          <input 
            className={`w-full border p-2 rounded text-sm focus:ring-2 outline-none transition ${
              errors.name 
                ? 'border-red-500 focus:ring-red-200' 
                : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
            }`}
            placeholder="e.g. Seed Round, Founder Cash" 
            value={name} 
            onChange={e => {
              setName(e.target.value);
              if (errors.name) setErrors({ ...errors, name: undefined });
            }} 
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>

        {/* Amount Input */}
        <div className="md:col-span-5">
          <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
            Amount ({currencySymbol}) <span className="text-red-500">*</span>
            <Tooltip content="Amount of capital injection." />
          </label>
          <input 
            type="number" 
            min="0"
            step="1000"
            className={`w-full border p-2 rounded text-sm focus:ring-2 outline-none transition ${
              errors.amount 
                ? 'border-red-500 focus:ring-red-200' 
                : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
            }`}
            placeholder="0.00" 
            value={amount} 
            onChange={e => {
              setAmount(e.target.value);
              if (errors.amount) setErrors({ ...errors, amount: undefined });
            }} 
          />
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
        </div>
      </div>

      {/* Timing Section - Two Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
        {/* Column 1: Absolute Month */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
            enter the absolute month <span className="text-red-500">*</span>
            <Tooltip content="Month in which capital is injected." />
          </label>
          <input 
            type="number" 
            min="0"
            max="120"
            className={`w-full border p-2 rounded text-sm focus:ring-2 outline-none transition ${
              errors.month 
                ? 'border-red-500 focus:ring-red-200' 
                : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
            }`}
            placeholder="0" 
            value={month} 
            onChange={e => handleMonthChange(e.target.value)} 
          />
          {errors.month && <p className="text-red-500 text-xs mt-1">{errors.month}</p>}
        </div>

        {/* Column 2: Relative Offset */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
            the offset in months vs the first month that received an investment, and I'll calculate the absolute month
          </label>
          <input 
            type="number" 
            className="w-full border border-gray-300 p-2 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
            placeholder="0" 
            value={offset} 
            onChange={e => handleOffsetChange(e.target.value)} 
          />
        </div>
      </div>

      <button 
        disabled={isSubmitting}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-md text-sm font-bold transition-colors flex justify-center items-center gap-2"
      >
        {isSubmitting ? 'Adding...' : 'Add Capital Injection'}
      </button>
    </form>
  );
}
</file>

