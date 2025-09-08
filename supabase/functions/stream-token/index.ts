import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { create } from 'https://deno.land/x/djwt@v2.8/mod.ts'

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

// Rate limiting configuration
const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 token requests per minute per user
}

// Simple in-memory rate limiter for Edge Functions
class EdgeRateLimiter {
  private static requests = new Map<string, number[]>()
  
  static isRateLimited(key: string): boolean {
    const now = Date.now()
    const windowStart = now - RATE_LIMIT.windowMs
    
    // Get request timestamps for this key
    let timestamps = this.requests.get(key) || []
    
    // Remove old timestamps
    timestamps = timestamps.filter(ts => ts > windowStart)
    
    // Check if limit exceeded
    if (timestamps.length >= RATE_LIMIT.maxRequests) {
      return true
    }
    
    // Add current timestamp
    timestamps.push(now)
    this.requests.set(key, timestamps)
    
    return false
  }
  
  static getRemainingRequests(key: string): number {
    const now = Date.now()
    const windowStart = now - RATE_LIMIT.windowMs
    const timestamps = this.requests.get(key) || []
    const recentRequests = timestamps.filter(ts => ts > windowStart)
    return Math.max(0, RATE_LIMIT.maxRequests - recentRequests.length)
  }
}

// Function to get appropriate CORS origin
const getCorsOrigin = (requestOrigin: string | null): string => {
  if (!requestOrigin) return 'null';
  
  // Check if the request origin is in our allowed list
  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }
  
  // For development, allow localhost variants
  if (requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1')) {
    return requestOrigin;
  }
  
  // Default deny
  return 'null';
};

// TypeScript fix for Deno
declare const Deno: any

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

    // Extract user identifier for rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const rateLimitKey = `stream-token:${clientIP}:${authHeader.split(' ')[1]?.substring(0, 10) || 'anonymous'}`
    
    // Check rate limit
    if (EdgeRateLimiter.isRateLimited(rateLimitKey)) {
      const remaining = EdgeRateLimiter.getRemainingRequests(rateLimitKey)
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          message: 'Too many token requests. Please try again later.',
          retryAfter: Math.ceil(RATE_LIMIT.windowMs / 1000)
        }),
        {
          headers: { 
            ...responseHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': RATE_LIMIT.maxRequests.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': Math.ceil((Date.now() + RATE_LIMIT.windowMs) / 1000).toString(),
            'Retry-After': Math.ceil(RATE_LIMIT.windowMs / 1000).toString()
          },
          status: 429,
        },
      )
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

    // Stream Chat configuration
    const STREAM_API_KEY = Deno.env.get('STREAM_API_KEY')
    const STREAM_API_SECRET = Deno.env.get('STREAM_API_SECRET')

    if (!STREAM_API_KEY || !STREAM_API_SECRET) {
      throw new Error('Stream Chat credentials not configured on the server.')
    }

    // Create JWT token with proper algorithm specification
    const header = {
      alg: "HS256",
      typ: "JWT",
    }

    const payload = {
      user_id: user.id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
    }

    // Convert the secret to a proper CryptoKey for JWT creation
    const secretKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(STREAM_API_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    )

    const token = await create(header, payload, secretKey)

    return new Response(
      JSON.stringify({ 
        token: token,
        user_id: user.id,
        expires_at: Math.floor(Date.now() / 1000) + (60 * 60 * 24)
      }),
      {
        headers: { ...responseHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('❌ Stream Token Function - Unhandled Error:', error)
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