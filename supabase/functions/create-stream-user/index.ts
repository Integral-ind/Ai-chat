// supabase/functions/create-stream-user/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Get allowed origins from environment variable or default to localhost for development
const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://localhost:5173',
  'https://localhost:3000'
];

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Function to get appropriate CORS origin
const getCorsOrigin = (requestOrigin: string | null): string => {
  if (!requestOrigin) return 'null';
  
  // Check if the request origin is in our allowed list
  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }
  
  // For development, allow localhost variants but be more restrictive
  if (requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1')) {
    // Only allow standard ports for development
    if (requestOrigin.match(/:(3000|5173|8080)$/)) {
      return requestOrigin;
    }
  }
  
  // Default deny
  return 'null';
};

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsOrigin = getCorsOrigin(origin);
  
  const responseHeaders = {
    ...corsHeaders,
    'Access-Control-Allow-Origin': corsOrigin,
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: responseHeaders })
  }

  try {

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      throw new Error('No authorization header provided')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      throw new Error('Unauthorized: ' + (userError?.message || 'No user found'))
    }

    // Parse request body
    const requestBody = await req.json()
    const { userId, name, email, avatar } = requestBody

    if (!userId) {
      throw new Error('Missing userId in request body')
    }

    // Stream Chat configuration
    const STREAM_API_KEY = Deno.env.get('STREAM_API_KEY')
    const STREAM_API_SECRET = Deno.env.get('STREAM_API_SECRET')

    if (!STREAM_API_KEY || !STREAM_API_SECRET) {
      throw new Error('Stream Chat credentials not configured')
    }

    // Create the user object for Stream Chat
    const streamUser = {
      id: userId,
      name: name || email || 'Unknown User',
      image: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=random`,
      email: email || undefined,
    }

    // Generate a server-side token for API requests
    const jwt = await import('https://deno.land/x/djwt@v2.8/mod.ts')
    
    const header = {
      alg: "HS256" as const,
      typ: "JWT",
    }

    const payload = {
      server: true,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
    }

    // Convert the secret to a proper CryptoKey for JWT creation
    const secretKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(STREAM_API_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    )

    const serverToken = await jwt.create(header, payload, secretKey)

    // Make API request to Stream Chat to create/update user
    // Use the global API endpoint instead of regional
    const streamApiUrl = `https://chat.stream-io-api.com/users?api_key=${STREAM_API_KEY}`

    const streamResponse = await fetch(streamApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': serverToken,
        'Stream-Auth-Type': 'jwt',
      },
      body: JSON.stringify({
        users: {
          [userId]: streamUser
        }
      })
    })

    if (!streamResponse.ok) {
      const errorText = await streamResponse.text()
      console.error('❌ Stream API Error:', errorText)
      console.error('❌ Stream API Status:', streamResponse.status)
      console.error('❌ Stream API Headers:', Object.fromEntries(streamResponse.headers.entries()))
      throw new Error(`Stream API error: ${streamResponse.status} - ${errorText}`)
    }

    const streamResult = await streamResponse.json()

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: streamUser,
        streamResult 
      }),
      {
        headers: { ...responseHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('❌ Create Stream User Function - Error:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Check function logs for more information'
      }),
      {
        headers: { ...responseHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})