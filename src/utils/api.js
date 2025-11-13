// Centralized API endpoint resolver for email-related serverless/express routes
// In development we hit the local Express server (server.js on port 4000)
// In production (Netlify) we call deployed serverless functions
export const getEmailEndpoint = (type) => {
  // Check if running on localhost (development) or deployed (production)
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (isDev) {
    switch (type) {
      case 'verification': return 'http://localhost:4000/send-verification';
      case 'receipt': return 'http://localhost:4000/send-receipt';
      case 'cancellation': return 'http://localhost:4000/send-cancellation';
      default: throw new Error('Unknown email endpoint type: ' + type);
    }
  } else {
    switch (type) {
      case 'verification': return '/.netlify/functions/sendVerification';
      case 'receipt': return '/.netlify/functions/sendReceipt';
      case 'cancellation': return '/.netlify/functions/sendCancellation';
      default: throw new Error('Unknown email endpoint type: ' + type);
    }
  }
};

// Generic POST helper with JSON + graceful HTML fallback
export async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    // Likely served an HTML page (e.g. dev server fallback) — build synthetic error
    const text = await res.text();
    throw new Error(`Non-JSON response from ${url}: ${text.substring(0,120)}...`);
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}