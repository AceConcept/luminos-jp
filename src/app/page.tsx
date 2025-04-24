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

interface FileSystemHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

declare global {
  interface Window {
    showSaveFilePicker(options?: {
      suggestedName?: string;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    }): Promise<FileSystemHandle>;
  }
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
    setResults([]); // Clear previous results

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

      if (processedResults.length === 0) {
        setError('no_words_found');
      } else {
        setResults(processedResults);
      }
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

  const exportToAnki = async () => {
    let blob: Blob | null = null;
    try {
      // Create CSV content
      const csvContent = results.map(({ word, reading, definition, partOfSpeech }) => 
        `${word};${reading};${partOfSpeech};${definition}`
      ).join('\n');

      // Add CSV header
      const csvWithHeader = `Front;Back;Part of Speech;Definition\n${csvContent}`;

      // Create blob
      blob = new Blob([csvWithHeader], { type: 'text/csv;charset=utf-8;' });

      // Show save dialog
      const handle = await window.showSaveFilePicker({
        suggestedName: 'anki_import.csv',
        types: [{
          description: 'CSV Files',
          accept: {
            'text/csv': ['.csv'],
          },
        }],
      });

      // Create a FileSystemWritableFileStream to write to
      const writable = await handle.createWritable();
      // Write the contents of the file to the stream
      await writable.write(blob);
      // Close the file and write the contents to disk
      await writable.close();
    } catch (err: unknown) {
      // If the user cancels the save dialog, we don't need to show an error
      if (err instanceof Error && err.name !== 'AbortError' && blob) {
        console.error('Export error:', err);
        // Fallback to direct download if the save dialog API is not supported
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'anki_import.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
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
          <h1 className="font-manrope text-[62px] leading-[74.4px] tracking-[-1.82px] text-[#0D0C22] max-w-[660px] text-center mb-[30px]">
            Discover the Key Words in Any Japanese Article
          </h1>

          <p className="font-inter text-[18px] leading-[24px] tracking-[-3%] text-[#0D0C22]/70 max-w-[660px] text-center mb-[30px]">
            Paste a link to a Japanese webpage, and we&apos;ll reveal the most used words—unlocking insights at a glance.
          </p>

          <div className="w-[700px] mx-auto">
            <div className="flex items-center bg-[#F3F3F6] rounded-full">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter link here..."
                className="flex-1 h-[53px] text-[14px] 
                         text-[#0D0C22]/70 placeholder-[#0D0C22]/70
                         border-none bg-transparent
                         font-manrope tracking-[0%]
                         pl-[24px] pr-[8px] py-[6px]
                         focus:outline-none focus:ring-0"
              />
              <button
                onClick={analyzeText}
                disabled={loading || !tokenizer}
                className="w-[40px] h-[40px] rounded-full
                         bg-[#6565FF] hover:bg-[#6565FF]
                         flex items-center justify-center
                         mr-2"
              >
                {loading ? (
                  <div className="w-[16px] h-[16px] border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-[16px] h-[16px] text-white" />
                )}
              </button>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600 text-center">
            Example: https://www3.nhk.or.jp/news
          </div>
        </div>

        {results.length > 0 && (
          <div className="fixed bottom-8 right-8 z-50 flex gap-4">
            <button
              onClick={copyAllToClipboard}
              className="flex items-center gap-2 h-[40px] px-5 py-[10px]
                       font-manrope font-medium text-[13px] text-[#000000]/60
                       bg-[#F3F3F6] border border-[#C8C8C8]
                       rounded-full hover:bg-[#E5E5E5] transition-colors
                       shadow-[0_2px_4px_0px_rgba(16,24,40,0.06)]"
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
            <button
              onClick={exportToAnki}
              className="flex items-center gap-2 h-[40px] px-5 py-[10px]
                       font-manrope font-medium text-[13px] text-[#000000]/60
                       bg-[#F3F3F6] border border-[#C8C8C8]
                       rounded-full hover:bg-[#E5E5E5] transition-colors
                       shadow-[0_2px_4px_0px_rgba(16,24,40,0.06)]"
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
                />
              </svg>
              Export to Anki
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg mt-6">
          <div className="flex flex-wrap justify-between space-y-2">
            {error && error !== 'no_words_found' ? (
              <div className="text-red-500 text-center">{error}</div>
            ) : loading ? (
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
            ) : error === 'no_words_found' ? (
              <div className="text-yellow-600 font-medium text-center w-full">
                Sorry, no Japanese words were found in this article. Please try another URL.
              </div>
            ) : null}
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
