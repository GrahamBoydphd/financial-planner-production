import { useState } from 'react';

interface DeleteButtonProps {
  onDelete: () => void;
  disabled?: boolean;
}

export default function DeleteButton({ onDelete, disabled }: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex gap-2">
        <button 
          onClick={onDelete} 
          disabled={disabled}
          className="text-red-600 font-bold hover:underline text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirm?
        </button>
        <button 
          onClick={() => setConfirming(false)} 
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
      onClick={() => setConfirming(true)} 
      disabled={disabled}
      className="text-red-400 hover:text-red-600 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Delete
    </button>
  );
}
