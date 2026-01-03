import { useState } from 'react';

export default function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex gap-2">
        <button 
          onClick={onDelete} 
          className="text-red-600 font-bold hover:underline text-xs"
        >
          Confirm?
        </button>
        <button 
          onClick={() => setConfirming(false)} 
          className="text-gray-500 hover:text-gray-700 text-xs"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={() => setConfirming(true)} 
      className="text-red-400 hover:text-red-600 text-xs"
    >
      Delete
    </button>
  );
}
