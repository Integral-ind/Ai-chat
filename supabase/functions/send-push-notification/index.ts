import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import 'https://deno.land/x/xhr@0.1.0/mod.ts';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp?: number;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

interface RequestBody {
  subscription: PushSubscription;
  payload: PushPayload;
}

// Web Push helper functions
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToUrlBase64(uint8Array: Uint8Array): string {
  let binary = '';
  uint8Array.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateVapidHeaders(
  endpoint: string,
  subject: string,
  publicKey: string,
  privateKey: string
): Promise<Record<string, string>> {
  // For simplicity, we'll use a minimal JWT implementation
  // In production, you might want to use a proper JWT library
  
  const header = {
    typ: 'JWT',
    alg: 'ES256'
  };

  const payload = {
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 hours
    sub: subject
  };

  const encoder = new TextEncoder();
  const headerBase64 = uint8ArrayToUrlBase64(encoder.encode(JSON.stringify(header)));
  const payloadBase64 = uint8ArrayToUrlBase64(encoder.encode(JSON.stringify(payload)));

  // For this example, we'll use a simplified approach
  // In production, you'd want to properly implement VAPID authentication
  return {
    'Authorization': `vapid t=${headerBase64}.${payloadBase64}.signature, k=${publicKey}`,
    'Crypto-Key': `p256ecdsa=${publicKey}`
  };
}

async function sendWebPushNotification(
  subscription: PushSubscription,
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const payloadString = JSON.stringify(payload);
    
    // Generate VAPID headers
    const vapidHeaders = await generateVapidHeaders(
      subscription.endpoint,
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    );

    // Prepare the request
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
      'Content-Length': payloadString.length.toString(),
      'TTL': '86400', // 24 hours
      ...vapidHeaders
    };

    // For encrypted payloads, you would need to implement Web Push encryption here
    // For simplicity, we're sending unencrypted payloads (not recommended for production)
    
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers,
      body: payloadString
    });

    if (response.ok) {
      return { success: true, statusCode: response.status };
    } else {
      const errorText = await response.text();
      return { 
        success: false, 
        statusCode: response.status, 
        error: errorText || 'Unknown error' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  try {
    // Get environment variables
    const vapidPublicKey = Deno.env.get('VITE_VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:noreply@example.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Parse request body
    const { subscription, payload }: RequestBody = await req.json();

    if (!subscription || !subscription.endpoint || !payload) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Send the push notification
    const result = await sendWebPushNotification(
      subscription,
      payload,
      vapidPublicKey,
      vapidPrivateKey,
      vapidSubject
    );

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );

  } catch (error) {
    console.error('Error in send-push-notification function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});