'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import DeleteButton from '@/components/ui/DeleteButton';

// Define the shape of a Capital Item based on your backend response
export interface CapitalItem {
  id: string;
  injection_name: string; // Updated to match API V3 (Scoped Naming)
  amount: string; // Strict Type: String from backend (Decimal)
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
            <p className="font-semibold text-gray-900 text-sm">{item.injection_name}</p>
            <p className="text-xs text-gray-500">Deposited in Month {item.month}</p>
          </div>

          {/* Right: Amount and Delete */}
          <div className="flex items-center gap-4">
            <span className="font-bold text-green-700 bg-green-50 px-2 py-1 rounded text-sm">
              +${Number(item.amount).toLocaleString()}
            </span>
            
            <DeleteButton 
              onDelete={() => handleDelete(item.id)}
              disabled={deletingId === item.id}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
