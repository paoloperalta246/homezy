const sgMail = require("@sendgrid/mail");
const admin = require("firebase-admin");

// Lazy, safe initialization to avoid module-load crashes on missing/invalid env
function ensureFirebaseAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT environment variable");
  }
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (e) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
  }
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

function ensureSendGrid() {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    throw new Error("Missing SENDGRID_API_KEY environment variable");
  }
  // setApiKey is idempotent for same key; calling per request is fine
  sgMail.setApiKey(key);
}

module.exports = async (req, res) => {
  // Helper: safely read JSON body across environments
  const readJson = () => new Promise((resolve, reject) => {
    try {
      if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) {
        return resolve(req.body);
      }
      let data = '';
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => {
        try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
      });
    } catch (e) { reject(e); }
  });

  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    // Ensure dependencies/env are ready and report JSON errors if not
    ensureFirebaseAdmin();
    ensureSendGrid();

    const { email, fullName } = await readJson();

    // Generate Firebase verification link
    const link = await admin.auth().generateEmailVerificationLink(email);

    const fullNameGreet = fullName || "there";

    const msg = {
      to: email,
      from: {
        name: "Homezy Support 🏠",
        email: "paoloschoolacc@gmail.com",
      },
      subject: "Verify your Homezy account ✨",
      html: `
        <div style="background-color:#f4f6f8; padding:40px 0; font-family:'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <div style="max-width:640px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 6px 24px rgba(0,0,0,0.08);">

            <!-- Header -->
            <div style="background:linear-gradient(135deg, #f97316, #fb923c); padding:30px 20px; text-align:center;">
              <h1 style="color:white; margin:0; font-size:26px; letter-spacing:1px;">
                The Homezy Team
              </h1>
            </div>

            <!-- Body -->
            <div style="padding:40px 35px; text-align:left;">
              <h2 style="color:#222; font-weight:700; margin-bottom:12px;">
                Hey there, ${fullNameGreet}! 👋
              </h2>
              <p style="color:#444; font-size:16px; line-height:1.7; margin-bottom:24px;">
                Welcome to <strong style="color:#f97316;">Homezy</strong> — your home away from home. <br/>
                We're excited to have you join our community of guests and hosts!
              </p>

              <div style="text-align:center; margin:30px 0;">
                <a href="${link}" 
                  style="display:inline-block; background:#f97316; color:white; text-decoration:none; 
                  font-weight:600; padding:14px 36px; border-radius:10px; 
                  font-size:16px; letter-spacing:0.5px; transition:background 0.3s ease;">
                  Verify My Email
                </a>
              </div>

              <p style="color:#555; font-size:15px; line-height:1.7;">
                Once verified, you'll be able to explore listings, message hosts, and manage your stays all in one place.  
                It only takes a few seconds to confirm your account.
              </p>

              <div style="margin:36px 0; padding:18px; background-color:#fff7ed; border-radius:10px; border-left:4px solid #f97316;">
                <p style="color:#92400e; font-size:14px; margin:0;">
                  ⚠️ If you didn't request this, please ignore this email — your account is still safe.
                </p>
              </div>

              <p style="font-size:14px; color:#888; text-align:center;">
                Need help? Contact our support team at
                <a href="mailto:homezy.support@gmail.com" style="color:#f97316; text-decoration:none;">homezy.support@gmail.com</a>
              </p>
            </div>

            <!-- Footer -->
            <div style="background:#f9fafb; padding:20px; text-align:center; border-top:1px solid #eee;">
              <p style="font-size:12px; color:#999; margin:0;">
                © ${new Date().getFullYear()} Homezy, Inc. All rights reserved.<br/>
                123 Homezy Street, Manila, Philippines 🇵🇭
              </p>
            </div>

          </div>
        </div>
      `,
    };

    await sgMail.send(msg);

    res.status(200).json({ success: true, message: "Verification email sent!" });
  } catch (error) {
    console.error("❌ Error sending verification email:", error);
    try {
      res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
    } catch (_) {
      // If headers already sent or response errored, ensure function returns
      res.end();
    }
  }
};
