'use client';

import React, { useState } from 'react';

interface InfoTagProps {
  content: string;
}

export default function InfoTag({ content }: InfoTagProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-flex ml-2 align-text-bottom z-10">
      <button
        type="button"
        className="flex items-center justify-center w-4 h-4 text-[10px] font-serif font-bold text-gray-500 bg-gray-100 border border-gray-300 rounded-full hover:bg-gray-200 hover:text-gray-800 focus:outline-none cursor-default transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsVisible(!isVisible);
        }}
        aria-label="More information"
      >
        i
      </button>
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-50 font-sans font-normal normal-case leading-snug text-center">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
}
