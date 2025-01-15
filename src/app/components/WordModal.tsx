import React from 'react';

interface WordModalProps {
  word: string;
  reading: string;
  definition: string;
  partOfSpeech: string;
  isOpen: boolean;
  onClose: () => void;
  onCopy: () => void;
}

export default function WordModal({ 
  word, 
  reading, 
  definition, 
  partOfSpeech, 
  isOpen, 
  onClose,
  onCopy
}: WordModalProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `${word} (${reading})\n${partOfSpeech}\n${definition}`
    );
    onCopy();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg p-3 max-w-[500px] w-full mx-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{word}</span>
            <span className="text-base text-gray-600">({reading})</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleCopy}
              className="rounded-full"
            >
              <svg 
                className="w-5 h-5 text-[#0F0F0F]"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" 
                />
              </svg>
            </button>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">
              {partOfSpeech}
            </div>
            <div className="text-base text-[#787878] leading-relaxed">
              {definition}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 