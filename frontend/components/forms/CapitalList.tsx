'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

// Define the shape of a Capital Item based on your backend response
export interface CapitalItem {
  id: string;
  name: string;
  amount: number;
  month: number;
}

interface Props {
  items: CapitalItem[];
  onDelete: () => void; // Trigger data refresh after deletion
}

export default function CapitalList({ items, onDelete }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.deleteCapitalInjection(id);
      onDelete(); // Refresh parent data
    } catch (error) {
      console.error("Failed to delete injection", error);
    } finally {
      setDeletingId(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center p-6 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
        <p className="text-gray-400 italic text-sm">
          No capital injections recorded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      {items.map((item) => (
        <div 
          key={item.id} 
          className="flex justify-between items-center border border-gray-200 p-3 rounded-lg bg-white hover:border-green-300 transition-colors shadow-sm"
        >
          {/* Left: Name and Month */}
          <div>
            <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
            <p className="text-xs text-gray-500">Deposited in Month {item.month}</p>
          </div>

          {/* Right: Amount and Delete */}
          <div className="flex items-center gap-4">
            <span className="font-bold text-green-700 bg-green-50 px-2 py-1 rounded text-sm">
              +${item.amount.toLocaleString()}
            </span>
            
            <button
              onClick={() => handleDelete(item.id)}
              disabled={deletingId === item.id}
              className="text-gray-400 hover:text-red-600 transition-colors p-1"
              title="Delete Injection"
            >
              {deletingId === item.id ? (
                // Simple Loading Spinner
                <div className="w-4 h-4 border-2 border-gray-300 border-t-red-600 rounded-full animate-spin"></div>
              ) : (
                // Trash Icon (Heroicons style)
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
