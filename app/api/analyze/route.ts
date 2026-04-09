import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'No URL provided.' }, { status: 400 });
    }

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

    let finalUrl = url;

    if (!isLikelyPolicyPage) {
      // Look for policy links
      let policyUrl = '';
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().toLowerCase();
        if (href && (text.includes('privacy') || text.includes('terms') || href.toLowerCase().includes('privacy') || href.toLowerCase().includes('terms'))) {
          // Resolve relative URL
          try {
            const resolvedUrl = new URL(href, url).toString();
            policyUrl = resolvedUrl;
            // Prefer privacy policy over terms if we find it
            if (text.includes('privacy') || href.toLowerCase().includes('privacy')) {
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
    
    const contentToAnalyze = $('body').text().replace(/\s+/g, ' ').trim();
    
    if (!contentToAnalyze || contentToAnalyze.length < 100) {
      return NextResponse.json(
        { error: 'Could not extract sufficient text from the provided URL. Please try pasting the text directly.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ text: contentToAnalyze, finalUrl });
  } catch (error: any) {
    console.error('Fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while fetching the URL.' },
      { status: 500 }
    );
  }
}

