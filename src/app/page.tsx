'use client';

import React from 'react';
import { useState, useEffect } from 'react';
const wanakana = require('wanakana');
import * as kuromoji from 'kuromoji';
import { Search } from 'lucide-react';
import WordModal from './components/WordModal';

interface WordResult {
  word: string;
  count: number;
  reading: string;
  extraReadings: number;
  definition: string;
  partOfSpeech: string;
}

interface Tokenizer {
  tokenize: (text: string) => Token[];
}

interface Token {
  surface_form: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [results, setResults] = useState<WordResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenizer, setTokenizer] = useState<Tokenizer | null>(null);
  const [selectedWord, setSelectedWord] = useState<WordResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    kuromoji.builder({ dicPath: '/dict' })
      .build((err: Error | null, _tokenizer: Tokenizer) => {
        if (err) {
          console.error('Tokenizer error:', err);
        } else {
          setTokenizer(_tokenizer);
        }
      });
  }, []);

  const getDefinition = async (word: string): Promise<string> => {
    try {
      const response = await fetch('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      });
      const data = await response.json();
      return data.definition;
    } catch (error) {
      console.error('Definition error:', error);
      return 'Error fetching definition';
    }
  };

  const isKanji = (text: string): boolean => {
    return /[\u4E00-\u9FAF]/.test(text);
  };

  const analyzeText = async () => {
    if (!url) {
      setError('Please enter a URL');
      return;
    }

    if (!tokenizer) {
      setError('Tokenizer not ready');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();
      
      if (!data.content) {
        throw new Error('No content received from URL');
      }

      const tokens = tokenizer.tokenize(data.content);
      const wordCount = new Map<string, number>();
      
      // First, collect all words and their counts
      tokens.forEach(token => {
        const word = token.surface_form;
        if (word.length > 1 && isKanji(word)) {
          wordCount.set(word, (wordCount.get(word) || 0) + 1);
        }
      });

      // Get more than 25 words initially since some might be filtered out
      const topWords = Array.from(wordCount.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 50); // Increased from 25 to 50 to have enough backup words

      // Process words until we get 20 valid ones
      const processedResults = [];
      for (const [word, count] of topWords) {
        try {
          const response = await fetch('/api/dictionary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word }),
          });
          const data = await response.json();
          
          if (data.definition !== 'Error fetching definition' && 
              data.definition !== 'No definition found') {
            processedResults.push({ 
              word, 
              count, 
              reading: data.reading || wanakana.toRomaji(word),
              extraReadings: data.extraReadings || 0,
              definition: data.definition,
              partOfSpeech: data.partOfSpeech || 'noun'
            });
          }

          if (processedResults.length === 20) break;
        } catch (error) {
          continue;
        }
      }

      setResults(processedResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze text');
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyAllToClipboard = () => {
    const textToCopy = results.map(({ word, reading, partOfSpeech, definition }) => 
      `${word} (${reading})\n${partOfSpeech}\n${definition}`
    ).join('\n\n');

    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      })
      .catch(err => console.error('Failed to copy text: ', err));
  };

  const handleWordClick = (word: WordResult) => {
    setSelectedWord(word);
    setIsModalOpen(true);
  };

  const Toast = () => (
    <div className="fixed bottom-8 left-8 bg-black text-white px-4 py-2 rounded-lg 
                    shadow-lg transition-opacity duration-200 z-50">
      Content has been copied
    </div>
  );

  return (
    <>
      <header className="h-[80px] flex items-center">
        <div className="mx-auto max-w-[1016px] w-full">
          <span className="text-[20px] text-[#393939]">luminos.jp</span>
        </div>
      </header>
      <main className="mx-auto max-w-[1016px] py-8">
        <div className="max-w-2xl mx-auto mb-12">
          <p className="text-center mb-6 text-gray-700">
            Enter a link to a japanese article or webpage you are<br />
            using to begin. We will show you the most used words
          </p>

          <div className="relative w-[648px] mx-auto">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter link here..."
              className="w-full h-[56px] px-6 rounded-full text-[16px] 
                       text-[#79797B] placeholder-[#79797B]
                       border border-gray-200
                       shadow-[0_12px_16px_-4px_rgba(16,24,40,0.08)]
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={analyzeText}
              disabled={loading || !tokenizer}
              className="absolute right-2 top-1/2 -translate-y-1/2
                       w-[44px] h-[44px] rounded-full
                       bg-blue-500 hover:bg-blue-600 
                       transition-colors disabled:bg-blue-300
                       flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-5 h-5 text-white" />
              )}
            </button>
          </div>

          <div className="mt-4 text-sm text-gray-600 text-center">
            Example URL: https://www3.nhk.or.jp/news
          </div>
        </div>

        {results.length > 0 && (
          <div className="fixed bottom-8 right-8 z-50">
            <button
              onClick={copyAllToClipboard}
              className="flex items-center gap-2 px-6 py-3 bg-[#F2F2F2] text-[#0F0F0F] 
                         rounded-full hover:bg-[#E5E5E5] transition-colors
                         shadow-lg text-base"
            >
              <svg 
                className="w-5 h-5"
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
              Copy Results
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg">
          <div className="flex flex-wrap justify-between space-y-2">
            {error && (
              <div className="text-red-500 text-center">{error}</div>
            )}
            {loading ? (
              <div className="text-blue-500 text-center">Analyzing... Please wait.</div>
            ) : results.length > 0 ? (
              <div className="flex flex-wrap justify-between">
                {results.map(({ word, count, reading, definition, partOfSpeech, extraReadings }, index) => (
                  <div 
                    key={index} 
                    className="bg-white rounded-lg p-3 border border-[#D9D9D9] 
                             flex flex-col
                             w-[229.5px] h-[105px] mb-4"
                  >
                    {/* Top row: Kanji and icons */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span 
                          className={`font-bold ${word.length > 3 ? 'text-sm' : 'text-base'} 
                                     cursor-pointer hover:text-blue-600 transition-colors`}
                          onClick={() => handleWordClick({
                            word,
                            reading,
                            definition,
                            partOfSpeech,
                            count,
                            extraReadings
                          })}
                        >
                          {word}
                        </span>
                        <span className={`text-gray-600 ${word.length > 3 ? 'text-[10px]' : 'text-xs'}`}>
                          ({reading})
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#0F0F0F]">#{index + 1}</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${word} (${reading})\n${partOfSpeech || 'noun'}\n${definition}`
                            );
                          }}
                          className="rounded-full"
                        >
                          <svg 
                            className="w-3.5 h-3.5 text-[#0F0F0F]"
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
                      </div>
                    </div>

                    {/* Bottom row: Part of speech and definition */}
                    <div className="mt-auto">
                      <div className="text-[10px] mb-0.5 text-gray-600 leading-[15px]">
                        {partOfSpeech.split(' ').slice(0, 2).join(' ')}
                      </div>
                      <div className="text-[12px] text-[#787878] leading-[15px] line-clamp-2 overflow-hidden">
                        {definition}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-red-500 text-center">{error}</div>
            ) : (
              <div className="text-yellow-600 font-medium text-center">
                Sorry, no Japanese words were found in this article. Please try another URL.
              </div>
            )}
          </div>
        </div>
      </main>

      <WordModal
        word={selectedWord?.word || ''}
        reading={selectedWord?.reading || ''}
        definition={selectedWord?.definition || ''}
        partOfSpeech={selectedWord?.partOfSpeech || ''}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCopy={() => {
          setShowToast(true);
          setTimeout(() => setShowToast(false), 2000);
        }}
      />

      {showToast && <Toast />}
    </>
  );
}
