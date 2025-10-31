import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: join(__dirname, '../.env') });

// Initialize Razorpay instance with test keys
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_ID';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || 'YOUR_KEY_SECRET';

// Debug log (remove in production)
console.log('🔑 Razorpay Key ID loaded:', razorpayKeyId);
console.log('🔑 Razorpay Key Secret:', razorpayKeySecret ? '✅ Present' : '❌ Missing');

const razorpayInstance = new Razorpay({
  key_id: razorpayKeyId,
  key_secret: razorpayKeySecret
});

/**
 * Create Razorpay order with payment hold (escrow simulation)
 * @param {number} amount - Amount in rupees (will be converted to paise)
 * @param {string} dealId - Deal ID for reference
 * @param {object} notes - Additional metadata
 * @returns {Promise<object>} - Razorpay order object
 * 
 * IMPORTANT LIMITS:
 * - Test Mode: Razorpay limits transactions to ₹50,000 (this is Razorpay's restriction)
 * - Our App Maximum: ₹2,00,000 (2 lakhs) - works in live mode
 * - Live Mode: ₹10,00,000+ (configurable based on KYC and account limits)
 * 
 * NOTE: If you see "amount exceeded" errors in test mode with amounts > ₹50,000,
 * this is a Razorpay test mode limitation. You have two options:
 * 1. Test with amounts ≤ ₹50,000 (e.g., ₹47,000 product = ₹49,350 total with commission)
 * 2. Switch to live mode (requires KYC completion) for amounts up to ₹2,00,000
 */
export const createOrder = async (amount, dealId, notes = {}) => {
  try {
    // Validate amount
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Check if using test keys
    const isTestMode = razorpayKeyId.includes('test');
    const TEST_MODE_LIMIT = 50000; // Razorpay test mode limit: ₹50,000
    const LIVE_MODE_LIMIT = 200000; // Our application limit: ₹2,00,000

    if (isTestMode && amount > TEST_MODE_LIMIT) {
      throw new Error(
        `Test mode is limited to ₹${TEST_MODE_LIMIT.toLocaleString('en-IN')}. ` +
        `Your amount (₹${amount.toLocaleString('en-IN')}) exceeds this limit. ` +
        `Please use a product priced at ₹${Math.floor(TEST_MODE_LIMIT / 1.05).toLocaleString('en-IN')} or less, ` +
        `or switch to live mode for higher amounts.`
      );
    }

    if (amount > LIVE_MODE_LIMIT) {
      throw new Error(
        `Amount exceeds maximum limit of ₹${LIVE_MODE_LIMIT.toLocaleString('en-IN')}. ` +
        `Please contact support for higher limits.`
      );
    }

    // Shorten receipt to fit Razorpay's 40 character limit
    const shortDealId = dealId.toString().slice(-12); // Last 12 chars of dealId
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
    
    const amountInPaise = Math.round(amount * 100); // Convert to paise (₹100 = 10000 paise)
    
    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `d_${shortDealId}_${timestamp}`, // Max 40 chars: d_ + 12 + _ + 8 = 23 chars
      payment_capture: 0, // Hold payment (don't auto-capture) - ESCROW SIMULATION
      notes: {
        dealId,
        type: 'buyer_escrow_payment',
        amountInRupees: amount,
        ...notes
      }
    };

    console.log('📝 Creating Razorpay order:');
    console.log(`   Amount: ₹${amount.toLocaleString('en-IN')} (${amountInPaise} paise)`);
    console.log(`   Order ID: ${options.receipt}`);
    console.log(`   Currency: ${options.currency}`);
    
    const order = await razorpayInstance.orders.create(options);
    console.log('✅ Razorpay order created:', order.id);
    
    return order;
  } catch (error) {
    console.error('❌ Razorpay order creation failed:', error);
    
    // Enhanced error messages for common issues
    if (error.message && error.message.includes('amount')) {
      throw new Error(`Amount validation failed: ${error.message}`);
    }
    
    if (error.error && error.error.description) {
      throw new Error(`Razorpay error: ${error.error.description}`);
    }
    
    throw new Error(`Failed to create Razorpay order: ${error.message}`);
  }
};

/**
 * Verify Razorpay payment signature (for webhook/payment success)
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Razorpay signature
 * @returns {boolean} - True if signature is valid
 */
export const verifyPaymentSignature = (orderId, paymentId, signature) => {
  try {
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const isValid = generatedSignature === signature;
    
    if (isValid) {
      console.log('✅ Payment signature verified');
    } else {
      console.warn('⚠️ Invalid payment signature');
    }
    
    return isValid;
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
};

/**
 * Capture held payment (release from escrow when shipping confirmed)
 * @param {string} paymentId - Razorpay payment ID
 * @param {number} amount - Amount to capture in rupees
 * @returns {Promise<object>} - Captured payment object
 */
export const capturePayment = async (paymentId, amount) => {
  try {
    const captureAmount = Math.round(amount * 100); // Convert to paise
    
    console.log(`💰 Capturing payment ${paymentId} for ₹${amount}`);
    const payment = await razorpayInstance.payments.capture(paymentId, captureAmount, 'INR');
    console.log('✅ Payment captured successfully');
    
    return payment;
  } catch (error) {
    console.error('❌ Payment capture failed:', error);
    throw new Error(`Failed to capture payment: ${error.message}`);
  }
};

/**
 * Void/refund held payment (if deal fails or expires)
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<object>} - Refund object
 */
export const voidPayment = async (paymentId) => {
  try {
    console.log(`🔄 Voiding/refunding payment ${paymentId}`);
    
    // Fetch payment details first
    const payment = await razorpayInstance.payments.fetch(paymentId);
    
    if (payment.status === 'authorized') {
      // For authorized (not captured) payments, we can't refund directly
      // We just don't capture it, and it will auto-refund after 5 days
      console.log('⏳ Payment is authorized but not captured. Will auto-refund in 5 days.');
      return { status: 'will_auto_refund', message: 'Payment will be auto-refunded by Razorpay' };
    } else if (payment.status === 'captured') {
      // For captured payments, create a refund
      const refund = await razorpayInstance.payments.refund(paymentId, {
        amount: payment.amount,
        speed: 'normal',
        notes: {
          reason: 'Deal failed or expired'
        }
      });
      console.log('✅ Refund initiated:', refund.id);
      return refund;
    } else {
      console.log(`⚠️ Payment status is ${payment.status}, no action needed`);
      return { status: payment.status };
    }
  } catch (error) {
    console.error('❌ Payment void/refund failed:', error);
    throw new Error(`Failed to void payment: ${error.message}`);
  }
};

/**
 * Create payout to cardholder (disburse commission after shipping)
 * ⚠️ TEST MODE: This will be simulated (no real money transfer)
 * @param {string} accountNumber - Cardholder's bank account number
 * @param {string} ifsc - Bank IFSC code
 * @param {number} amount - Amount in rupees
 * @param {string} dealId - Deal ID for reference
 * @returns {Promise<object>} - Payout object
 */
export const createPayout = async (accountNumber, ifsc, amount, dealId, cardholderName) => {
  try {
    const payoutAmount = Math.round(amount * 100); // Convert to paise
    
    // 🧪 TEST MODE: Simulate payout without actual transfer
    console.log('🧪 TEST MODE: Simulating bank payout');
    console.log(`💸 Payout Details:`);
    console.log(`   To: ${cardholderName}`);
    console.log(`   Account: ${accountNumber}`);
    console.log(`   IFSC: ${ifsc}`);
    console.log(`   Amount: ₹${amount}`);
    console.log(`   Deal ID: ${dealId}`);
    
    // Return mock payout object (simulates successful payout)
    const mockPayout = {
      id: `pout_test_${Date.now()}`,
      entity: 'payout',
      amount: payoutAmount,
      currency: 'INR',
      status: 'processing', // Will become 'processed' after webhook simulation
      mode: 'NEFT',
      purpose: 'refund',
      reference_id: `deal_${dealId}_payout_${Date.now()}`,
      narration: `SplitPay - Deal ${dealId}`,
      fund_account: {
        id: `fa_test_${Date.now()}`,
        entity: 'fund_account',
        account_type: 'bank_account',
        bank_account: {
          name: cardholderName,
          ifsc: ifsc,
          account_number: accountNumber
        }
      },
      notes: {
        dealId,
        type: 'cardholder_disbursement',
        simulated: true,
        test_mode: true
      },
      created_at: Math.floor(Date.now() / 1000)
    };
    
    console.log('✅ Mock payout created:', mockPayout.id);
    console.log('ℹ️  In live mode, this would transfer real money to the cardholder');
    
    // Simulate webhook after 5 seconds (payout.processed)
    setTimeout(() => {
      console.log(`✅ Mock payout ${mockPayout.id} marked as processed (simulated)`);
    }, 5000);
    
    return mockPayout;
    
    // 🔴 LIVE MODE CODE (Uncomment when you have KYC + RazorpayX activated):
    /*
    const payoutData = {
      account_number: process.env.RAZORPAY_ACCOUNT_NUMBER, // Your Razorpay X current account
      amount: payoutAmount,
      currency: 'INR',
      mode: 'IMPS',
      purpose: 'payout',
      fund_account: {
        account_type: 'bank_account',
        bank_account: {
          name: cardholderName,
          account_number: accountNumber,
          ifsc: ifsc
        },
        contact: {
          name: cardholderName,
          type: 'customer'
        }
      },
      queue_if_low_balance: true,
      reference_id: `deal_${dealId}_payout_${Date.now()}`,
      narration: `SplitPay - Deal ${dealId}`,
      notes: {
        dealId,
        type: 'cardholder_disbursement'
      }
    };
    
    const payout = await razorpayInstance.payouts.create(payoutData);
    console.log('✅ Payout created:', payout.id);
    return payout;
    */
  } catch (error) {
    console.error('❌ Payout simulation failed:', error);
    throw new Error(`Failed to create payout: ${error.message}`);
  }
};

/**
 * Create UPI payout to cardholder (alternative to bank transfer)
 * ⚠️ TEST MODE: This will be simulated (no real money transfer)
 * @param {string} vpa - UPI VPA (e.g., name@paytm)
 * @param {number} amount - Amount in rupees
 * @param {string} dealId - Deal ID for reference
 * @returns {Promise<object>} - Payout object
 */
export const createUPIPayout = async (vpa, amount, dealId, cardholderName) => {
  try {
    const payoutAmount = Math.round(amount * 100); // Convert to paise
    
    // 🧪 TEST MODE: Simulate UPI payout without actual transfer
    console.log('🧪 TEST MODE: Simulating UPI payout');
    console.log(`💸 UPI Payout Details:`);
    console.log(`   To: ${cardholderName}`);
    console.log(`   UPI VPA: ${vpa}`);
    console.log(`   Amount: ₹${amount}`);
    console.log(`   Deal ID: ${dealId}`);
    
    // Return mock payout object (simulates successful UPI payout)
    const mockPayout = {
      id: `pout_test_upi_${Date.now()}`,
      entity: 'payout',
      amount: payoutAmount,
      currency: 'INR',
      status: 'processing', // Will become 'processed' after webhook simulation
      mode: 'UPI',
      purpose: 'refund',
      reference_id: `deal_${dealId}_upi_${Date.now()}`,
      narration: `SplitPay - Deal ${dealId}`,
      fund_account: {
        id: `fa_test_upi_${Date.now()}`,
        entity: 'fund_account',
        account_type: 'vpa',
        vpa: {
          username: vpa.split('@')[0],
          handle: vpa.split('@')[1],
          address: vpa
        },
        contact: {
          name: cardholderName,
          type: 'customer'
        }
      },
      notes: {
        dealId,
        type: 'cardholder_disbursement_upi',
        simulated: true,
        test_mode: true
      },
      created_at: Math.floor(Date.now() / 1000)
    };
    
    console.log('✅ Mock UPI payout created:', mockPayout.id);
    console.log('ℹ️  In live mode, money would be transferred to', vpa);
    
    // Simulate webhook after 3 seconds (UPI is faster)
    setTimeout(() => {
      console.log(`✅ Mock UPI payout ${mockPayout.id} marked as processed (simulated)`);
    }, 3000);
    
    return mockPayout;
    
    // 🔴 LIVE MODE CODE (Uncomment when you have KYC + RazorpayX activated):
    /*
    const payoutData = {
      account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
      amount: payoutAmount,
      currency: 'INR',
      mode: 'UPI',
      purpose: 'payout',
      fund_account: {
        account_type: 'vpa',
        vpa: {
          address: vpa
        },
        contact: {
          name: cardholderName,
          type: 'customer'
        }
      },
      queue_if_low_balance: true,
      reference_id: `deal_${dealId}_upi_${Date.now()}`,
      narration: `SplitPay - Deal ${dealId}`,
      notes: {
        dealId,
        type: 'cardholder_disbursement_upi'
      }
    };
    
    const payout = await razorpayInstance.payouts.create(payoutData);
    console.log('✅ UPI Payout created:', payout.id);
    return payout;
    */
  } catch (error) {
    console.error('❌ UPI Payout simulation failed:', error);
    throw new Error(`Failed to create UPI payout: ${error.message}`);
  }
};

/**
 * Fetch payment details
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<object>} - Payment object
 */
export const fetchPayment = async (paymentId) => {
  try {
    const payment = await razorpayInstance.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    console.error('❌ Failed to fetch payment:', error);
    throw new Error(`Failed to fetch payment: ${error.message}`);
  }
};

/**
 * Verify webhook signature from Razorpay
 * @param {string} webhookBody - Raw request body
 * @param {string} signature - X-Razorpay-Signature header
 * @returns {boolean} - True if signature is valid
 */
export const verifyWebhookSignature = (webhookBody, signature) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.warn('⚠️ RAZORPAY_WEBHOOK_SECRET not configured');
      return false;
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(webhookBody)
      .digest('hex');

    const isValid = expectedSignature === signature;
    
    if (isValid) {
      console.log('✅ Webhook signature verified');
    } else {
      console.warn('⚠️ Invalid webhook signature');
    }
    
    return isValid;
  } catch (error) {
    console.error('❌ Webhook signature verification error:', error);
    return false;
  }
};

export default razorpayInstance;
