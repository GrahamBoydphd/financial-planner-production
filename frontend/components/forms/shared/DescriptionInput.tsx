import React from 'react';

interface DescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  maxWords?: number;
}

export function DescriptionInput({
  value,
  onChange,
  label = "Description",
  placeholder = "Enter description...",
  className = "",
  maxWords = 200
}: DescriptionInputProps) {
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length;
  const isOverLimit = wordCount > maxWords;

  return (
    <div className={className}>
      <label className="block text-sm font-medium mb-1 text-gray-700">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full p-2 border rounded h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          isOverLimit ? 'border-red-500' : 'border-gray-300'
        }`}
        placeholder={placeholder}
      />
      <div className={`text-xs text-right mt-1 ${isOverLimit ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
        {wordCount}/{maxWords} words
      </div>
    </div>
  );
}
