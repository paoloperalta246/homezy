const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    const { email, fullName, listingTitle, checkIn, checkOut, guests, price } = await readJson();

    const msg = {
      to: email,
      from: { name: "Homezy Support 🏠", email: "paoloschoolacc@gmail.com" },
      subject: `❌ Your Homezy Booking Was Cancelled – ${listingTitle}`,
      html: `
      <div style="background-color:#f4f6f8; padding:50px 0; font-family:'Inter', sans-serif;">
        <div style="max-width:640px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg, #EF4444, #DC2626); padding:30px 20px; text-align:center;">
            <h1 style="color:white; margin:0; font-size:28px;">Homezy Booking Cancelled</h1>
          </div>
          <div style="padding:40px 35px; text-align:left;">
            <h2 style="color:#222; font-weight:700;">Hi ${fullName || "there"}! 👋</h2>
            <p style="color:#444; font-size:16px;">Your booking at <strong style="color:#EF4444;">${listingTitle}</strong> has been cancelled. Total paid: PHP ${price}</p>
          </div>
          <div style="background:#f9fafb; padding:20px; text-align:center; border-top:1px solid #eee;">
            <p style="font-size:12px; color:#999; margin:0;">© ${new Date().getFullYear()} Homezy, Inc. All rights reserved.</p>
          </div>
        </div>
      </div>`
    };

    await sgMail.send(msg);

    res.status(200).json({ success: true, message: "Cancellation email sent!" });
  } catch (error) {
    console.error("❌ Error sending cancellation email:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
