import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { GoogleGenAI, Type } from '@google/genai';

// Initialize Gemini on the server side using the private environment variable
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { url, text } = await req.json();

    let contentToAnalyze = text || '';
    let finalUrl = url || '';

    if (url) {
      // Fetch the URL content
      let response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
          { status: 400 }
        );
      }

      let html = await response.text();
      let $ = cheerio.load(html);

      // Check if we need to find a policy link
      const urlLower = url.toLowerCase();
      const isLikelyPolicyPage = urlLower.includes('privacy') || urlLower.includes('terms') || urlLower.includes('tos') || urlLower.includes('legal') || urlLower.includes('policy');

      if (!isLikelyPolicyPage) {
        // Look for policy links
        let policyUrl = '';
        $('a').each((i, el) => {
          const href = $(el).attr('href');
          const linkText = $(el).text().toLowerCase();
          if (href && (linkText.includes('privacy') || linkText.includes('terms') || href.toLowerCase().includes('privacy') || href.toLowerCase().includes('terms'))) {
            // Resolve relative URL
            try {
              const resolvedUrl = new URL(href, url).toString();
              policyUrl = resolvedUrl;
              // Prefer privacy policy over terms if we find it
              if (linkText.includes('privacy') || href.toLowerCase().includes('privacy')) {
                return false; // break the loop early if we found a privacy policy
              }
            } catch (e) {}
          }
        });

        if (policyUrl) {
          finalUrl = policyUrl;
          // Fetch the actual policy page
          const policyResponse = await fetch(policyUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
          });
          if (policyResponse.ok) {
            html = await policyResponse.text();
            $ = cheerio.load(html);
          }
        }
      }
      
      // Remove scripts, styles, nav, footer to get main content
      $('script, style, nav, footer, header, aside, noscript, iframe').remove();
      
      contentToAnalyze = $('body').text().replace(/\s+/g, ' ').trim();
    }

    // Truncate if too long (Gemini 3.1 Pro can handle a lot, but let's be safe)
    const maxLength = 150000;
    if (contentToAnalyze.length > maxLength) {
      contentToAnalyze = contentToAnalyze.substring(0, maxLength);
    }

    if (!contentToAnalyze || contentToAnalyze.length < 100) {
      return NextResponse.json(
        { error: 'Could not extract sufficient text from the provided URL. Please try pasting the text directly.' },
        { status: 400 }
      );
    }

    const prompt = `Analyze the following Privacy Policy or Terms of Service document.
      
Document Content:
${contentToAnalyze}

Please provide a detailed analysis including:
1. An overall summary of the policy.
2. What the site does with user data after an account is created (data usage).
3. Potential risks to the user (e.g., selling data, arbitration clauses, loss of rights).
4. Compliance issues or status regarding major regulations (GDPR, CCPA, etc.).
5. An overall privacy score from 0 to 100 (100 being most privacy-respecting).
`;

    const genResult = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: 'Overall summary of the policy' },
            dataUsage: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING, description: 'Category of data collected' },
                  purpose: { type: Type.STRING, description: 'How the data is used' },
                  quote: { type: Type.STRING, description: 'Exact substring from the document proving this' },
                },
              },
            },
            risks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  severity: { type: Type.STRING, description: 'High, Medium, or Low' },
                  quote: { type: Type.STRING, description: 'Exact substring from the document proving this' },
                },
              },
            },
            compliance: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  regulation: { type: Type.STRING, description: 'e.g., GDPR, CCPA' },
                  status: { type: Type.STRING, description: 'Compliant, Non-Compliant, or Unclear' },
                  details: { type: Type.STRING },
                  quote: { type: Type.STRING, description: 'Exact substring from the document proving this' },
                },
              },
            },
            score: { type: Type.NUMBER, description: 'Privacy score from 0 to 100' },
          },
          required: ['summary', 'dataUsage', 'risks', 'compliance', 'score'],
        },
      },
    });

    const analysisText = genResult.text;
    if (!analysisText) {
      throw new Error('No text returned from Gemini');
    }

    const analysis = JSON.parse(analysisText);

    return NextResponse.json({ analysis, text: contentToAnalyze, finalUrl });
  } catch (error: any) {
    console.error('Fetch/Analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while analyzing the document.' },
      { status: 500 }
    );
  }
}

