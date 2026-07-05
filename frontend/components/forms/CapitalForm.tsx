'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import Tooltip from '@/components/ui/Tooltip';

interface Props {
  planId: string;
  onSuccess: () => void;
  currencySymbol?: string;
  itemToEdit?: any;
  onCancel?: () => void;
}

interface FormErrors {
  name?: string;
  amount?: string;
  month?: string;
  submit?: string;
}

export default function CapitalForm({ 
  planId, 
  onSuccess, 
  currencySymbol = '$',
  itemToEdit,
  onCancel
}: Props) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState('');
  const [offset, setOffset] = useState('');
  const [anchorMonth, setAnchorMonth] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Query or determine the absolute month of the first investment on record
  useEffect(() => {
    let isMounted = true;
    const fetchAnchor = async () => {
      try {
        let injections: any[] = [];
        
        // Target formalized client gateway service functions
        if (typeof api.getCapitalInjections === 'function') {
          injections = await api.getCapitalInjections(planId);
        } else if (typeof (api as any).getPlan === 'function') {
          const plan = await (api as any).getPlan(planId);
          injections = plan.capital_injections || plan.capitalInjections || [];
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

  // Hydration Lifecycle for itemToEdit (Checks if currently being edited)
  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.injection_name || '');
//      setAmount(itemToEdit.amount ? itemToEdit.amount.toString() : '');
      setAmount(itemToEdit.amount ? Math.round(Number(itemToEdit.amount)).toString() : '');
      const mVal = itemToEdit.month !== undefined && itemToEdit.month !== null ? itemToEdit.month.toString() : '';
      setMonth(mVal);

      if (mVal && anchorMonth !== undefined && anchorMonth !== null) {
        const parsedMonth = parseInt(mVal, 10);
        if (!isNaN(parsedMonth)) {
          setOffset((parsedMonth - anchorMonth).toString());
        }
      }
    } else {
      setName('');
      setAmount('');
      setMonth('');
      setOffset('');
    }
    setErrors({});
  }, [itemToEdit, anchorMonth]);

  // Bidirectional Sync: Absolute Month Input Changes
  const handleMonthChange = (val: string) => {
    setMonth(val);
    if (errors.month) {
      setErrors(prev => ({ ...prev, month: undefined }));
    }

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
      if (errors.month) {
        setErrors(prev => ({ ...prev, month: undefined }));
      }
    } else {
      setMonth('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors: FormErrors = {};
    if (!name.trim()) {
      newErrors.name = 'Source Name is required';
    }
    
    if (!amount) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(Number(amount)) || Number(amount) < 0) {
      newErrors.amount = 'Amount must be a positive number';
    }
    
    if (!month) {
      newErrors.month = 'Month is required';
    } else {
      const parsedMonth = parseInt(month, 10);
      if (isNaN(parsedMonth) || parsedMonth < 0) {
        newErrors.month = 'Month cannot be negative';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Clear errors and submit
    setErrors({});
    setIsSubmitting(true);
    
    try {
      // Force 2 decimal places for Rust strictness (String-Decimal Standard)
      const formattedAmount = parseFloat(amount).toFixed(2);

      if (itemToEdit?.id) {
        const payload = {
          injection_name: name,
          amount: formattedAmount,
          month: parseInt(month, 10)
        };

        // Explicitly target the formalized client gateway service function
        await api.updateCapitalInjection(itemToEdit.id, payload);
      } else {
        const payload = {
          plan_id: planId,
          injection_name: name,
          amount: formattedAmount,
          month: parseInt(month, 10)
        };

        // Explicitly target the formalized client gateway service function
        await api.createCapitalInjection(payload);
      }

      // Reset local states upon successful network callback
      setName('');
      setAmount('');
      setMonth('');
      setOffset('');
      setErrors({});
      
      // Invoke parent callbacks to trigger modal/side-panel clearing
      onSuccess();
    } catch (error: any) {
      console.error("Failed to save capital injection", error);
      const apiError = error.response?.data?.error || error.message || "An error occurred while saving";
      setErrors(prev => ({ ...prev, submit: apiError }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-gray-800 text-sm">
          {itemToEdit ? 'Edit Injection' : 'Add New Injection'}
        </h3>
        <span className="text-xs text-gray-400">Fixed Amount</span>
      </div>

      {errors.submit && (
        <div className="p-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded">
          {errors.submit}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Name Input */}
        <div className="md:col-span-7">
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Source Name <span className="text-red-500">*</span>
          </label>
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
              if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
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
            placeholder="0" 
            value={amount} 
            onChange={e => {
              setAmount(e.target.value);
              if (errors.amount) setErrors(prev => ({ ...prev, amount: undefined }));
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
            Enter the absolute month <span className="text-red-500">*</span>
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
            Offset vs first investment month
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

      <div className="flex gap-2">
        {itemToEdit && onCancel && (
          <button 
            type="button"
            onClick={onCancel}
            className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-md text-sm font-bold transition-colors"
          >
            Cancel
          </button>
        )}
        <button 
          type="submit"
          disabled={isSubmitting}
          className={`${itemToEdit ? 'w-2/3' : 'w-full'} bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-md text-sm font-bold transition-colors flex justify-center items-center gap-2`}
        >
          {isSubmitting 
            ? (itemToEdit ? 'Saving...' : 'Adding...') 
            : (itemToEdit ? 'Save Changes' : 'Add Capital Injection')}
        </button>
      </div>
    </form>
  );
}
