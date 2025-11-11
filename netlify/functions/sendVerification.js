const sgMail = require("@sendgrid/mail");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

// ===== Initialize Firebase Admin SDK =====
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  initializeApp({
    credential: cert(serviceAccount),
  });
  console.log("✅ Firebase Admin initialized successfully");
} catch (err) {
  console.error("❌ Failed to initialize Firebase Admin:", err);
}

// ===== Initialize SendGrid =====
try {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("✅ SendGrid initialized successfully");
} catch (err) {
  console.error("❌ Failed to initialize SendGrid:", err);
}

exports.handler = async function (event, context) {
  console.log("📨 sendVerification function called");

  try {
    const { email, fullName } = JSON.parse(event.body);
    const fullNameGreet = fullName || "there";

    console.log("📧 Email to send to:", email);
    console.log("👤 Full name:", fullNameGreet);

    // ===== Generate Firebase Email Verification Link =====
    let link;
    try {
      const actionCodeSettings = {
        url: "https://app-homezy.netlify.app/verified", // your Verified.js page
        handleCodeInApp: false,
      };
      link = await getAuth().generateEmailVerificationLink(email, actionCodeSettings);
      console.log("✅ Verification link generated:", link);
    } catch (err) {
      console.error("❌ Error generating Firebase verification link:", err);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: "Failed to generate verification link" }),
      };
    }

    // ===== Send email with SendGrid =====
    const msg = {
      to: email,
      from: { name: "Homezy Support 🏠", email: "paoloschoolacc@gmail.com" }, // must be verified in SendGrid
      subject: "Verify your Homezy account ✨",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f4f4f4;">
          <h2>Hello ${fullNameGreet} 👋</h2>
          <p>Welcome to <strong>Homezy</strong>! Click below to verify your email:</p>
          <a href="${link}" style="padding: 10px 20px; background: #f97316; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
        </div>
      `,
    };

    await sgMail.send(msg);
    console.log("✅ Verification email sent successfully");

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Verification email sent!" }),
    };
  } catch (error) {
    console.error("❌ Error in sendVerification function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
