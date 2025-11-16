// PayPal Payouts API withdrawal endpoint for Vercel/Netlify serverless
// Requires environment variables: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET
// Uses PayPal Sandbox by default

const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, email, hostUid } = req.body;
  if (!amount || !email || !hostUid) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Get PayPal credentials from environment
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'PayPal credentials not set in environment' });
  }

  // PayPal API endpoints
  const PAYPAL_API = 'https://api-m.sandbox.paypal.com'; // Use sandbox for testing

  try {
    // 1. Get OAuth2 token
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(500).json({ error: 'PayPal auth failed', details: tokenData });
    }
    const accessToken = tokenData.access_token;

    // 2. Create a payout
    const payoutRes = await fetch(`${PAYPAL_API}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: `batch_${Date.now()}`,
          email_subject: 'You have a payout from Homezy',
        },
        items: [
          {
            recipient_type: 'EMAIL',
            amount: {
              value: amount.toFixed(2),
              currency: 'PHP',
            },
            receiver: email,
            note: 'Homezy host withdrawal',
            sender_item_id: hostUid,
          },
        ],
      }),
    });
    const payoutData = await payoutRes.json();
    if (!payoutRes.ok) {
      return res.status(500).json({ error: 'PayPal payout failed', details: payoutData });
    }

    // Success: return payout info
    return res.status(200).json({ success: true, payout: payoutData });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
};
