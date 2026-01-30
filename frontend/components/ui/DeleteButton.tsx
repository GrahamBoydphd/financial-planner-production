import { useState } from 'react';
import { Trash2 } from 'lucide-react';

interface DeleteButtonProps {
  onDelete: () => void;
  disabled?: boolean;
}

export default function DeleteButton({ onDelete, disabled }: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex gap-2 items-center">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }} 
          disabled={disabled}
          className="text-red-600 font-bold hover:underline text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirm?
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(false);
          }} 
          disabled={disabled}
          className="text-gray-500 hover:text-gray-700 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={(e) => {
        e.stopPropagation();
        setConfirming(true);
      }} 
      disabled={disabled}
      className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Delete"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
