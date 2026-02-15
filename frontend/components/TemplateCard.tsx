import React from 'react';
import { Template } from '@/lib/api';

interface TemplateCardProps {
  template: Template;
  onCopy: (id: string) => void;
  isProcessing?: boolean;
}

const ImportIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const Spinner = () => (
  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function TemplateCard({ template, onCopy, isProcessing = false }: TemplateCardProps) {
  // Logic: Handle 'fund' and 'company' types. Default to 'Fund'.
  // We cast to any to access potential dynamic fields from backend variants
  const t = template as any;
  const rawType = t.type || 'Fund';
  const isFund = rawType.toLowerCase() === 'fund';
  
  // Badge styling based on type
  const typeBadgeClasses = isFund 
    ? 'bg-blue-100 text-blue-800' 
    : 'bg-purple-100 text-purple-800';

  // Fallback name resolution: name -> fund_name -> company_name -> Untitled
  const displayName = template.name || t.fund_name || t.company_name || 'Untitled Template';

  // Dynamic button text
  const importText = isFund ? 'Import Fund' : 'Import Company';

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col h-full overflow-hidden">
      
      {/* Header/Top: Badges */}
      <div className="px-5 pt-5 pb-2 flex justify-between items-start">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeBadgeClasses}`}>
          {rawType}
        </span>
        
        <div className="flex gap-2">
          {template.industry && (
             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
               {template.industry}
             </span>
          )}
          {template.complexity && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100">
              {template.complexity}
            </span>
          )}
        </div>
      </div>

      {/* Middle: Content */}
      <div className="px-5 flex-1 flex flex-col">
        <h3 className="text-lg font-bold text-gray-900 mt-2">
          {displayName}
        </h3>
        
        <p className="text-sm text-gray-500 mt-2">
          {template.description}
        </p>
      </div>

      {/* Bottom: Action */}
      <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
        <button
          onClick={() => onCopy(template.id)}
          disabled={isProcessing}
          title={`Import this ${rawType.toLowerCase()}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {isProcessing ? <Spinner /> : <ImportIcon />}
          <span>{isProcessing ? 'Importing...' : importText}</span>
        </button>
      </div>
    </div>
  );
}
