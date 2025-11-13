const sgMail = require("@sendgrid/mail");

function ensureSendGrid() {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    throw new Error("Missing SENDGRID_API_KEY environment variable");
  }
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
    ensureSendGrid();
    const { email, fullName, listingTitle, checkIn, checkOut, guests, price } = await readJson();

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
      `
    };

    await sgMail.send(msg);

    res.status(200).json({ success: true, message: "Receipt email sent!" });
  } catch (error) {
    console.error("❌ Error sending receipt email:", error);
    try {
      res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
    } catch (_) {
      res.end();
    }
  }
};
