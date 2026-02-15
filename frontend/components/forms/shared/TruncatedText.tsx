'use client';
import { useState } from 'react';

interface Props {
  text?: string | null;
  limit?: number;
  className?: string;
}

export default function TruncatedText({ text, limit = 10, className = "text-sm text-gray-500" }: Props) {
  const [expanded, setExpanded] = useState(false);
  
  if (!text) return null;
  
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return <p className={className}>{text}</p>;

  return (
    <div className={className}>
      <p>
        {expanded ? text : words.slice(0, limit).join(' ') + '...'}
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="ml-1 text-blue-600 hover:underline text-xs font-medium"
        >
          {expanded ? '(show less)' : '(read more)'}
        </button>
      </p>
    </div>
  );
}
