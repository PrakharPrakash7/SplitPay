import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, enum: ["buyer", "cardholder"], required: true },
  firebaseUid: { type: String },
  fcmToken: { type: String, default: null },
  
  // Credit Cards for Cardholders
  creditCards: [{
    bank: { type: String }, // HDFC, ICICI, SBI, etc.
    cardType: { type: String, default: 'credit' }, // credit/debit
    lastFourDigits: { type: String } // Optional: last 4 digits for identification
  }],
  
  // Payment Details for Buyers (for Razorpay payments)
  buyerPaymentDetails: {
    preferredUPI: { type: String, default: null }, // UPI VPA like name@upi
    phone: { type: String, default: null },
    defaultAddress: {
      name: String,
      mobile: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String
    }
  },
  
  // Payout Details for Cardholders (for receiving disbursements)
  cardholderPayoutDetails: {
    accountType: { 
      type: String, 
      enum: ["bank_account", "upi"], 
      default: null 
    },
    // Bank Account Details
    bankAccount: {
      accountNumber: { type: String, default: null },
      ifsc: { type: String, default: null },
      accountHolderName: { type: String, default: null },
      bankName: { type: String, default: null }
    },
    // UPI Details
    upiVPA: { type: String, default: null }, // For UPI payouts
    verified: { type: Boolean, default: false }
  },
  
  // Stats
  stats: {
    totalDeals: { type: Number, default: 0 },
    completedDeals: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 }, // For cardholders (commission earned)
    totalSavings: { type: Number, default: 0 }  // For buyers (discount saved)
  },
  
  createdAt: { type: Date, default: Date.now }
});

// Index for faster lookups (email already has unique index from schema)
userSchema.index({ role: 1 });
userSchema.index({ firebaseUid: 1 });

export default mongoose.model("User", userSchema);

