import { NextResponse } from 'next/server';

interface JishoResponse {
  japanese: {
    reading?: string;
  }[];
  senses: {
    english_definitions: string[];
    parts_of_speech: string[];
  }[];
}

export async function POST(request: Request) {
  try {
    const { word } = await request.json();
    const response = await fetch(
      `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`
    );
    const data = await response.json();
    const firstResult = data.data[0] as JishoResponse;
    
    if (!firstResult) {
      return NextResponse.json({ definition: 'No definition found' });
    }

    const readings = firstResult.japanese.map(j => j.reading).filter(Boolean);
    const mainReading = readings[0];
    const extraReadings = readings.length > 1 ? readings.length - 1 : 0;

    let partOfSpeech = firstResult.senses[0]?.parts_of_speech[0] || 'noun';
    partOfSpeech = partOfSpeech.split(' ')[0].toLowerCase();
    
    if (partOfSpeech === 'verb') {
      const verbType = firstResult.senses[0]?.parts_of_speech.find(
        (pos: string) => pos.includes('ichidan') || pos.includes('godan')
      );
      if (verbType) {
        partOfSpeech = verbType.includes('ichidan') ? 'ichidan verb' : 'godan verb';
      }
    }

    return NextResponse.json({
      definition: firstResult.senses[0]?.english_definitions.join('; ') || 'No definition found',
      reading: mainReading,
      extraReadings,
      partOfSpeech
    });
  } catch (err) {
    console.error('Dictionary error:', err);
    return NextResponse.json(
      { 
        definition: 'Error fetching definition',
        reading: '',
        extraReadings: 0,
        partOfSpeech: 'noun'
      },
      { status: 500 }
    );
  }
} 