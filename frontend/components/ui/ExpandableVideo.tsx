'use client';

import React, { useState } from 'react';

interface ExpandableVideoProps {
  videoId: string;
}

export default function ExpandableVideo({ videoId }: ExpandableVideoProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isExpanded) {
    return (
      <div className="w-full aspect-video mb-6 rounded-lg shadow-xl overflow-hidden clear-both">
        <iframe
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    );
  }

  return (
    <div 
      onClick={() => setIsExpanded(true)}
      className="float-right ml-4 mb-2 w-64 h-36 relative cursor-pointer group rounded-lg shadow-lg overflow-hidden border-2 border-white/20 hover:border-white"
    >
      <img 
        src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} 
        alt="Video thumbnail" 
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200">
          <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
