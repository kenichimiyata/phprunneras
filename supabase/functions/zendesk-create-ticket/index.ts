// supabase/functions/zendesk-create-ticket/index.ts

// Fix: Removed unresolved Deno types reference, as no Deno-specific globals are used.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // CORSプリフライトリクエストへの対応
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { subdomain, email, token, subject, comment } = await req.json();

    if (!subdomain || !email || !token || !subject || !comment) {
      throw new Error('Missing required fields: subdomain, email, token, subject, comment');
    }

    const zendeskUrl = `https://${subdomain}.zendesk.com/api/v2/tickets.json`;
    
    // Zendesk APIは 'email/token:{api_token}' の形式でBasic認証を要求します
    const credentials = btoa(`${email}/token:${token}`);

    const response = await fetch(zendeskUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({
        ticket: {
          subject: subject,
          comment: {
            body: comment,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Zendesk API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const responseData = await response.json();

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in Zendesk Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// To deploy:
// 1. Ensure you have the Supabase CLI installed.
// 2. Deploy the function: `supabase functions deploy zendesk-create-ticket --no-verify-jwt`
// Note: --no-verify-jwt is used here because we are passing credentials in the body.
// For higher security, consider storing credentials as Supabase secrets
// and using the Authorization header with a Supabase JWT from the client.