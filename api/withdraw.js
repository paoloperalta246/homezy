// Trigger redeploy: minor comment change
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

    // 3. Save withdrawal record to Firestore
    try {
      // Lazy import to avoid issues in serverless
      const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
      const { getFirestore, Timestamp } = require('firebase-admin/firestore');
      const admin = require('firebase-admin');

      // Only initialize once
      if (!admin.apps.length) {
        let credential;
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
          // Use service account from env variable (Vercel/Netlify)
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          credential = admin.credential.cert(serviceAccount);
        } else {
          // Fallback to application default (local dev with GOOGLE_APPLICATION_CREDENTIALS)
          credential = admin.credential.applicationDefault();
        }
        admin.initializeApp({ credential });
      }
      const db = getFirestore();
      const hostRef = db.collection('hosts').doc(hostUid);
      await hostRef.collection('withdrawals').add({
        amount: Number(amount),
        email,
        createdAt: Timestamp.now(),
        payoutBatchId: payoutData.batch_header?.payout_batch_id || null,
        status: payoutData.batch_header?.batch_status || 'PENDING',
      });
      // Optionally update withdrawn total
      await hostRef.set({
        withdrawn: admin.firestore.FieldValue.increment(Number(amount))
      }, { merge: true });
    } catch (firestoreErr) {
      // Log but don't block payout response
      console.error('Error saving withdrawal to Firestore:', firestoreErr);
    }
    // Success: return payout info
    return res.status(200).json({ success: true, payout: payoutData });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
};
