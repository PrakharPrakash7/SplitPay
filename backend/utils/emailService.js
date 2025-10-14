import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Create transporter using Gmail (you can use any email service)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASS, // Your Gmail App Password (not regular password)
  },
});

/**
 * Send email notification to cardholders about a new deal
 * @param {Array} cardholders - Array of cardholder objects with name and email
 * @param {Object} deal - Deal object with product details
 */
export const sendDealNotificationEmail = async (cardholders, deal) => {
  if (!cardholders || cardholders.length === 0) {
    console.log("⚠ No cardholders to email");
    return;
  }

  const emailPromises = cardholders.map(async (cardholder) => {
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: cardholder.email,
      subject: "🎉 New Deal Available on SplitPay!",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
            .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { color: #4CAF50; font-size: 24px; margin-bottom: 20px; }
            .product-info { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .price { font-size: 28px; color: #4CAF50; font-weight: bold; }
            .discount { color: #ff5722; font-weight: bold; }
            .button { display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #888; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header">💸 New Deal Request!</div>
              <p>Hi ${cardholder.name},</p>
              <p>A buyer just posted a new deal on SplitPay. You could earn rewards by helping them!</p>
              
              <div class="product-info">
                <h3>${deal.product.title}</h3>
                ${deal.product.image ? `<img src="${deal.product.image}" alt="Product" style="max-width: 100%; border-radius: 5px; margin: 10px 0;">` : ''}
                <p><strong>Original Price:</strong> ₹${deal.product.price}</p>
                <p class="discount"><strong>Discount:</strong> ${deal.discountPct}% OFF</p>
                <p class="price">Discounted Price: ₹${deal.discountedPrice}</p>
                <p><strong>Product URL:</strong> <a href="${deal.product.url}" target="_blank">View Product</a></p>
              </div>
              
              <p><strong>⏰ Act fast!</strong> This deal expires in 15 minutes.</p>
              
              <a href="http://localhost:3000/cardholder-dashboard" class="button">View Deal Now</a>
              
              <div class="footer">
                <p>You received this email because you're registered as a cardholder on SplitPay.</p>
                <p>&copy; 2025 SplitPay. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✓ Email sent to: ${cardholder.email}`);
    } catch (error) {
      console.error(`✗ Failed to send email to ${cardholder.email}:`, error.message);
    }
  });

  await Promise.all(emailPromises);
};

/**
 * Test email configuration
 */
export const testEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log("✓ Email service is ready to send emails");
    return true;
  } catch (error) {
    console.error("✗ Email service configuration error:", error.message);
    return false;
  }
};
