import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    const response = await fetch(url);
    const html = await response.text();
    
    // Parse HTML and extract text content
    const $ = cheerio.load(html);
    
    // Remove script and style elements
    $('script, style').remove();
    
    // Get text content
    const content = $('body').text().trim();

    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch URL' },
      { status: 500 }
    );
  }
}