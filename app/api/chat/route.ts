import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { documentText, messages } = await req.json();

    if (!documentText) {
      return NextResponse.json({ error: 'Document text is required.' }, { status: 400 });
    }
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required.' }, { status: 400 });
    }

    const systemInstruction = `You are a legal assistant helping a user understand a Privacy Policy or Terms of Service document.
Answer the user's questions based ONLY on the provided document text. 
If the answer is not in the document, say "I cannot find the answer to that in the provided document."
Be concise, clear, and helpful. Use plain English.

Document Text:
${documentText.substring(0, 100000)} // Truncate to avoid exceeding limits if necessary
`;

    // Format history for Gemini
    const contents = messages.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    return NextResponse.json({ reply: response.text });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred during chat.' },
      { status: 500 }
    );
  }
}
