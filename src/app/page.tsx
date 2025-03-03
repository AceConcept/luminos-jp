'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import * as wanakana from 'wanakana';
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
          console.error('Analysis error:', error);
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
        <div className="flex flex-col items-center justify-center p-4">
          <h1 className="text-description mb-6">
            Enter a link to a japanese article or webpage you are
            <br />
            using to begin. We will show you the most used words
          </h1>

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
              className="absolute right-4 top-1/2 -translate-y-1/2
                       w-[32px] h-[32px] rounded-full
                       bg-[#D9D9D9] hover:bg-[#c4c4c4] 
                       transition-colors disabled:bg-[#e6e6e6]
                       flex items-center justify-center"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-[#161618] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4 text-[#161618]" />
              )}
            </button>
          </div>

          <div className="mt-4 text-sm text-gray-600 text-center">
            Example: https://www3.nhk.or.jp/news
          </div>
        </div>

        {results.length > 0 && (
          <div className="fixed bottom-8 right-8 z-50">
            <button
              onClick={copyAllToClipboard}
              className="flex items-center gap-2 px-6 py-3 bg-[#F2F2F2] text-[#0F0F0F] 
                         rounded-full hover:bg-[#E5E5E5] transition-colors
                         shadow-[0_2px_4px_0px_rgba(16,24,40,0.06)] text-base"
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

        <div className="bg-white rounded-lg mt-6">
          <div className="flex flex-wrap justify-between space-y-2">
            {error && (
              <div className="text-red-500 text-center">{error}</div>
            )}
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 w-full">
                <div className="dot-pulse"></div>
                <div className="text-blue-500">Analyzing... Please wait.</div>
              </div>
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
                                     cursor-pointer hover:text-blue-600 transition-colors
                                     underline underline-offset-4`}
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
                            )
                            .then(() => {
                              setShowToast(true);
                              setTimeout(() => setShowToast(false), 2000);
                            })
                            .catch(err => console.error('Failed to copy text: ', err));
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
            ) : url ? (
              <div className="text-yellow-600 font-medium text-center w-full">
                Sorry, no Japanese words were found in this article. Please try another URL.
              </div>
            ) : (
              <div className="text-gray-600 font-medium text-center w-full">
                Enter a link to begin
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
