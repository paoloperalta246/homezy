const sgMail = require("@sendgrid/mail");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

// 🔑 Initialize Firebase using your environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
  credential: cert(serviceAccount),
});

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async function(event, context) {
  try {
    const { email, fullName } = JSON.parse(event.body);
    const fullNameGreet = fullName || "there";

    // ✅ Generate Firebase verification link
    const actionCodeSettings = {
      url: "https://app-homezy.netlify.app/verified", // your Verified.js page
      handleCodeInApp: false,
    };

    const link = await getAuth().generateEmailVerificationLink(email, actionCodeSettings);

    const msg = {
      to: email,
      from: { name: "Homezy Support 🏠", email: "paoloschoolacc@gmail.com" },
      subject: "Verify your Homezy account ✨",
      html: `
      <div style="background-color:#f4f6f8; padding:40px 0; font-family:'Inter', sans-serif;">
        <div style="max-width:640px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 6px 24px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg, #f97316, #fb923c); padding:30px 20px; text-align:center;">
            <h1 style="color:white; margin:0; font-size:26px;">The Homezy Team</h1>
          </div>
          <div style="padding:40px 35px; text-align:left;">
            <h2 style="color:#222; font-weight:700; margin-bottom:12px;">Hey ${fullNameGreet}! 👋</h2>
            <p style="color:#444; font-size:16px; line-height:1.7;">Welcome to <strong style="color:#f97316;">Homezy</strong>! Verify your email below:</p>
            <div style="text-align:center; margin:30px 0;">
              <a href="${link}" style="display:inline-block; background:#f97316; color:white; text-decoration:none; font-weight:600; padding:14px 36px; border-radius:10px;">Verify My Email</a>
            </div>
          </div>
          <div style="background:#f9fafb; padding:20px; text-align:center; border-top:1px solid #eee;">
            <p style="font-size:12px; color:#999; margin:0;">© ${new Date().getFullYear()} Homezy, Inc. All rights reserved.</p>
          </div>
        </div>
      </div>`
    };

    await sgMail.send(msg);

    return { statusCode: 200, body: JSON.stringify({ success: true, message: "Verification email sent!" }) };
  } catch (error) {
    console.error("❌ Error sending verification email:", error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
