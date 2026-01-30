import React from 'react';

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  return (
    <div className="group relative inline-block">
      {children || (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="cursor-default text-gray-400 hover:text-gray-600"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
      )}
      <div className="invisible absolute bottom-full left-1/2 mb-1 w-48 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 z-50 pointer-events-none">
        {content}
        <div className="absolute left-1/2 top-full -ml-1 h-0 w-0 border-4 border-solid border-transparent border-t-gray-900" />
      </div>
    </div>
  );
};

export default Tooltip;
