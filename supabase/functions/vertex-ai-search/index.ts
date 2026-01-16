// supabase/functions/vertex-ai-search/index.ts

// Fix: Declare Deno to resolve TypeScript errors in environments where Deno's
// global types are not automatically recognized.
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

import { GoogleGenAI } from 'npm:@google/genai@^0.7.0';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Supabaseの環境変数からAPIキーを安全に取得
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable not set in Supabase.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const MODEL_NAME = 'gemini-2.5-flash';

serve(async (req) => {
  // CORSプリフライトリクエストへの対応
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { contents, systemInstruction } = await req.json();

    if (!contents) {
        throw new Error('Request body must contain "contents".');
    }

    const stream = await ai.models.generateContentStream({
        model: MODEL_NAME,
        contents: contents,
        config: {
            systemInstruction: systemInstruction,
            tools: [{ googleSearch: {} }],
        },
    });

    // ReadableStreamをクライアントにServer-Sent Events (SSE)形式で返す
    const responseStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const chunkString = JSON.stringify(chunk);
          controller.enqueue(`data: ${chunkString}\n\n`);
        }
        controller.close();
      },
    });
    
    return new Response(responseStream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// To deploy:
// 1. Ensure you have the Supabase CLI installed.
// 2. Set the Gemini API key as a secret: `supabase secrets set GEMINI_API_KEY your_api_key_here`
// 3. Deploy the function: `supabase functions deploy vertex-ai-search`