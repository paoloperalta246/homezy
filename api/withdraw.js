// Vercel Serverless Function for Withdrawals
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import sgMail from '@sendgrid/mail';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const PAYPAL_API_BASE = PAYPAL_MODE === 'live' ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com';

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

sgMail.setApiKey(SENDGRID_API_KEY);

const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { amount, email, hostUid } = req.body;
    if (!amount || !email || !hostUid) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Get PayPal access token
    const tokenRes = await axios({
      url: `${PAYPAL_API_BASE}/v1/oauth2/token`,
      method: 'post',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      auth: { username: PAYPAL_CLIENT_ID, password: PAYPAL_CLIENT_SECRET },
      data: 'grant_type=client_credentials',
    });
    const accessToken = tokenRes.data.access_token;
    // Payout via PayPal
    const payoutRes = await axios({
      url: `${PAYPAL_API_BASE}/v1/payments/payouts`,
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        sender_batch_header: {
          sender_batch_id: `batch_${Date.now()}`,
          email_subject: 'You have a payout!',
        },
        items: [
          {
            recipient_type: 'EMAIL',
            amount: { value: amount, currency: 'PHP' },
            receiver: email,
            note: 'Homezy Host Withdrawal',
            sender_item_id: `item_${Date.now()}`,
          },
        ],
      },
    });
    // Update Firestore: add withdrawal record and update withdrawn amount
    const db = getFirestore();
    const hostRef = db.collection('hosts').doc(hostUid);
    await hostRef.collection('withdrawals').add({
      amount,
      email,
      createdAt: FieldValue.serverTimestamp(),
    });
    await hostRef.update({
      withdrawn: FieldValue.increment(amount),
    });
    return res.status(200).json({ success: true, payout: payoutRes.data });
  } catch (error) {
    console.error('Withdrawal error:', error);
    return res.status(500).json({ error: error.message || 'Withdrawal failed' });
  }
}
