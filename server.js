// 📦 Import dependencies
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const sgMail = require("@sendgrid/mail");
const dotenv = require("dotenv");
const serviceAccount = require("./serviceAccountKey.json");

// 🧠 Load .env variables
dotenv.config();

// 💌 Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// 🔥 Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
});

// 🚀 Initialize Express
const app = express();
app.use(express.json());
app.use(cors());

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

// ✅ Prevent duplicate email sends - track recent sends
const recentEmailSends = new Map(); // { email: timestamp }
const EMAIL_COOLDOWN_MS = 10000; // 10 seconds cooldown between sends to same email

// � Firestore (Admin)
const fs = getFirestore();

// �📧 Generate link + send custom email
app.post("/send-verification", async (req, res) => {
  const { email, fullName, force } = req.body || {};

  const reqId = Math.random().toString(36).slice(2, 8).toUpperCase();
  console.log(`\n🔔 [${reqId}] ============ VERIFICATION EMAIL REQUEST ============`);
  console.log('📧 Email:', email);
  console.log('👤 Full Name:', fullName);
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('🔁 Force resend:', !!force);
  
  // ✅ Check if we recently sent to this email
  const lastSentTime = recentEmailSends.get(email);
  const now = Date.now();
  
  if (lastSentTime && (now - lastSentTime) < EMAIL_COOLDOWN_MS) {
    const waitTime = Math.ceil((EMAIL_COOLDOWN_MS - (now - lastSentTime)) / 1000);
    console.log(`⚠️ [${reqId}] DUPLICATE (cooldown) BLOCKED! Email sent ${Math.floor((now - lastSentTime) / 1000)}s ago. Wait ${waitTime}s.`);
    console.log('====================================================\n');
    return res.status(429).json({ 
      success: false, 
      error: `Please wait ${waitTime} seconds before requesting another verification email.` 
    });
  }
  
  console.log('====================================================\n');

  try {
    // 🔐 Lookup Firebase user by email and check verification status
    let userRecord = null;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (e) {
      console.warn(`[${reqId}] ⚠️ No Firebase user found for email: ${email}`);
    }

    if (userRecord && userRecord.emailVerified) {
      console.log(`[${reqId}] ✅ User already verified. Skipping email send.`);
      return res.status(200).json({ success: true, message: "Already verified. No email sent." });
    }

    // ✅ Idempotency: persist send state per UID to avoid sending twice across restarts
    const uidKey = userRecord ? userRecord.uid : `email:${email.toLowerCase()}`; // fallback key if user not yet resolvable
    const sendDocRef = fs.collection('email_verification_sends').doc(uidKey);
    const sendDocSnap = await sendDocRef.get();

    if (sendDocSnap.exists && !force) {
      const data = sendDocSnap.data();
      const alreadySent = !!data.lastSentAt && !data.verifiedAt;
      if (alreadySent) {
        console.log(`[${reqId}] 🚫 Idempotency block: email already sent previously and user not yet verified. Returning 200 without resending.`);
        return res.status(200).json({ success: true, message: "Verification email already sent." });
      }
    }

    // ✅ Record this send immediately (in-memory) to prevent burst duplicates
    recentEmailSends.set(email, Date.now());
    
    // Generate Firebase verification link
    const link = await admin.auth().generateEmailVerificationLink(email);
    console.log(`[${reqId}] ✅ Verification link generated:`, link.substring(0, 80) + '...');

    // 🪄 Use full name for greeting
    const fullNameGreet = fullName || "there";

    // 📧 Email Verification Route
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
                Once verified, you’ll be able to explore listings, message hosts, and manage your stays all in one place.  
                It only takes a few seconds to confirm your account.
              </p>

              <div style="margin:36px 0; padding:18px; background-color:#fff7ed; border-radius:10px; border-left:4px solid #f97316;">
                <p style="color:#92400e; font-size:14px; margin:0;">
                  ⚠️ If you didn’t request this, please ignore this email — your account is still safe.
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

    // ✉️ Send email
    await sgMail.send(msg);
    console.log(`[${reqId}] ✉️ Verification email sent via SendGrid`);

    // 🧾 Persist send record (idempotency)
    await sendDocRef.set({
      uid: userRecord ? userRecord.uid : null,
      email,
      fullName: fullName || null,
      lastSentAt: FieldValue.serverTimestamp(),
      verifiedAt: userRecord && userRecord.emailVerified ? FieldValue.serverTimestamp() : null,
      count: FieldValue.increment(1),
    }, { merge: true });
    
    // ✅ Clean up old entries to prevent memory leak (keep last hour)
    const oneHourAgo = Date.now() - 3600000;
    for (const [emailKey, timestamp] of recentEmailSends.entries()) {
      if (timestamp < oneHourAgo) {
        recentEmailSends.delete(emailKey);
      }
    }
    
    res.status(200).json({ success: true, message: "Verification email sent!" });
  } catch (error) {
    console.error(`[${reqId}] ❌ Error sending verification email:`, error);
    
    // ✅ Remove from cooldown if send failed, so user can retry
    recentEmailSends.delete(email);
    
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📧 Order Receipt Email Route
app.post("/send-receipt", async (req, res) => {
  const { email, fullName, listingTitle, checkIn, checkOut, guests, price } = req.body;

  try {
    const msg = {
      to: email,
      from: { name: "Homezy Support 🏠", email: "paoloschoolacc@gmail.com" },
      subject: `🏠 Your Homezy Booking Receipt – ${listingTitle}`,
      html: `
        <div style="background-color:#f4f6f8; padding:50px 0; font-family:'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <div style="max-width:640px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.08);">

            <!-- Header -->
            <div style="background:linear-gradient(135deg, #f97316, #fb923c); padding:30px 20px; text-align:center;">
              <h1 style="color:white; margin:0; font-size:28px; letter-spacing:1px;">Homezy Booking Receipt</h1>
            </div>

            <!-- Body -->
            <div style="padding:40px 35px; text-align:left;">
              <h2 style="color:#222; font-weight:700; margin-bottom:12px;">Hi ${fullName || "there"}! 👋</h2>
              <p style="color:#444; font-size:16px; line-height:1.7; margin-bottom:24px;">
                Thank you for booking with <strong style="color:#f97316;">Homezy</strong>. Here are your booking details:
              </p>

              <!-- Receipt Card -->
              <div style="background:#f9fafb; padding:30px; border-radius:12px; margin-bottom:24px; border:1px solid #e0e0e0;">
                <table style="width:100%; border-collapse:collapse; font-size:15px; color:#333;">
                  <tbody>
                    <tr style="background:#ffffff;">
                      <td style="padding:12px 15px; border-bottom:1px solid #e0e0e0;"><strong>Listing</strong></td>
                      <td style="padding:12px 15px; border-bottom:1px solid #e0e0e0;">${listingTitle}</td>
                    </tr>
                    <tr style="background:#f4f6f8;">
                      <td style="padding:12px 15px; border-bottom:1px solid #e0e0e0;"><strong>Check-in</strong></td>
                      <td style="padding:12px 15px; border-bottom:1px solid #e0e0e0;">${checkIn}</td>
                    </tr>
                    <tr style="background:#ffffff;">
                      <td style="padding:12px 15px; border-bottom:1px solid #e0e0e0;"><strong>Check-out</strong></td>
                      <td style="padding:12px 15px; border-bottom:1px solid #e0e0e0;">${checkOut}</td>
                    </tr>
                    <tr style="background:#f4f6f8;">
                      <td style="padding:12px 15px; border-bottom:1px solid #e0e0e0;"><strong>Guests</strong></td>
                      <td style="padding:12px 15px; border-bottom:1px solid #e0e0e0;">${guests || "1"}</td>
                    </tr>
                    <tr style="background:#ffffff;">
                      <td style="padding:12px 15px;"><strong>Total Paid</strong></td>
                      <td style="padding:12px 15px;">PHP ${price}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p style="color:#555; font-size:15px; line-height:1.7; margin-bottom:24px;">
                We hope you enjoy your stay! If you have any questions or need assistance, feel free to contact our support team.
              </p>

              <div style="margin:36px 0; padding:18px; background-color:#fff7ed; border-radius:10px; border-left:4px solid #f97316;">
                <p style="color:#92400e; font-size:14px; margin:0;">
                  ⚠️ If you did not make this booking, please contact us immediately.
                </p>
              </div>

              <p style="font-size:14px; color:#888; text-align:center; margin-top:25px;">
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
    console.log("✅ Styled order receipt email sent successfully!");
    res.status(200).json({ success: true, message: "Styled order receipt email sent!" });
  } catch (error) {
    console.error("❌ Error sending styled order receipt email:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📧 Styled Booking Cancellation Email Route
app.post("/send-cancellation", async (req, res) => {
  const { email, fullName, listingTitle, checkIn, checkOut, guests, price } = req.body;

  try {
    const msg = {
      to: email,
      from: { name: "Homezy Support 🏠", email: "paoloschoolacc@gmail.com" },
      subject: `❌ Your Homezy Booking Was Cancelled – ${listingTitle}`,
      html: `
        <div style="background-color:#f4f6f8; padding:50px 0; font-family:'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <div style="max-width:640px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.08);">

            <!-- Header -->
            <div style="background:linear-gradient(135deg, #EF4444, #DC2626); padding:30px 20px; text-align:center;">
              <h1 style="color:white; margin:0; font-size:28px; letter-spacing:1px;">Homezy Booking Cancelled</h1>
            </div>

            <!-- Body -->
            <div style="padding:40px 35px; text-align:left;">
              <h2 style="color:#222; font-weight:700; margin-bottom:12px;">Hi ${fullName || "there"}! 👋</h2>
              <p style="color:#444; font-size:16px; line-height:1.7; margin-bottom:24px;">
                We wanted to inform you that your booking at <strong style="color:#EF4444;">${listingTitle}</strong> has been cancelled.
              </p>

              <!-- Cancelled Booking Card -->
              <div style="background:#f9fafb; padding:30px; border-radius:12px; margin-bottom:24px; border:1px solid #FCA5A5;">
                <table style="width:100%; border-collapse:collapse; font-size:15px; color:#333;">
                  <tbody>
                    <tr style="background:#ffffff;">
                      <td style="padding:12px 15px; border-bottom:1px solid #e0e0e0;"><strong>Listing</strong></td>
                      <td style="padding:12px 15px; border-bottom:1px solid #e0e0e0;">${listingTitle}</td>
                    </tr>
                    <tr style="background:#f4f6f8;">
                      <td style="padding:12px 15px; border-bottom:1px solid #e0e0e0;"><strong>Check-in</strong></td>
                      <td style="padding:12px 15px; border-bottom:1px solid #e0e0e0;">${checkIn}</td>
                    </tr>
                    <tr style="background:#ffffff;">
                      <td style="padding:12px 15px; border-bottom:1px solid #e0e0e0;"><strong>Check-out</strong></td>
                      <td style="padding:12px 15px; border-bottom:1px solid #e0e0e0;">${checkOut}</td>
                    </tr>
                    <tr style="background:#f4f6f8;">
                      <td style="padding:12px 15px; border-bottom:1px solid #e0e0e0;"><strong>Guests</strong></td>
                      <td style="padding:12px 15px; border-bottom:1px solid #e0e0e0;">${guests || "1"}</td>
                    </tr>
                    <tr style="background:#ffffff;">
                      <td style="padding:12px 15px;"><strong>Total Paid</strong></td>
                      <td style="padding:12px 15px;">PHP ${price}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p style="color:#555; font-size:15px; line-height:1.7; margin-bottom:24px;">
                You've successfully cancelled your booking. If you have any questions or want to make a new booking, feel free to contact our support team.
              </p>

              <div style="margin:36px 0; padding:18px; background-color:#FEE2E2; border-radius:10px; border-left:4px solid #B91C1C;">
                <p style="color:#B91C1C; font-size:14px; margin:0;">
                  ⚠️ If you believe this is an error, please reach out to support as soon as possible.
                </p>
              </div>

              <p style="font-size:14px; color:#888; text-align:center; margin-top:25px;">
                Need help? Contact our support team at
                <a href="mailto:homezy.support@gmail.com" style="color:#EF4444; text-decoration:none;">homezy.support@gmail.com</a>
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
    console.log("✅ Styled cancellation email sent successfully!");
    res.status(200).json({ success: true, message: "Styled cancellation email sent!" });
  } catch (error) {
    console.error("❌ Error sending styled cancellation email:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// --- User Deletion API (admin only) ---
const deleteUserRoute = require("./api/deleteUser");
app.use("/api", deleteUserRoute);

// 🖥️ Run server
app.listen(4000, () => console.log("✅ Server running on port 4000"));
