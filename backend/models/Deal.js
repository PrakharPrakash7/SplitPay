import mongoose from "mongoose";

const DealSchema = new mongoose.Schema({
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  product: {
    title: String,
    image: String,
    price: Number,
    url: String,
    bankOffers: [{
      bank: String,
      offer: String,
      discount: String
    }]
  },
  discountPct: { type: Number, default: 10 },
  discountedPrice: Number,
  status: { 
    type: String, 
    enum: [
      "pending",           // Deal created, waiting for cardholder acceptance
      "matched",           // Cardholder accepted, waiting for buyer payment
      "awaiting_payment",  // Buyer needs to pay via Razorpay
      "payment_authorized",// Payment held in escrow
      "awaiting_address",  // Buyer needs to share address
      "address_shared",    // Address shared, cardholder can order
      "order_placed",      // Cardholder placed order
      "shipped",           // Order shipped
      "payment_captured",  // Payment captured from escrow
      "disbursed",         // Payout sent to cardholder
      "completed",         // Deal fully completed
      "expired",           // Deal expired
      "failed",            // Deal failed
      "refunded"           // Payment refunded to buyer
    ], 
    default: "pending" 
  },
  cardholderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  
  // Payment Flow Fields
  razorpayOrderId: { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },
  escrowStatus: { 
    type: String, 
    enum: ["none", "authorized", "captured", "refunded", "failed"],
    default: "none"
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "authorized", "captured", "refunded", "failed"],
    default: "pending"
  },
  
  // Shipping & Address Fields
  shippingDetails: {
    name: String,
    mobile: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    pincode: String,
    landmark: String
  },
  
  // Cardholder Order Details
  orderIdFromCardholder: { type: String, default: null },
  invoiceUrl: { type: String, default: null },
  trackingUrl: { type: String, default: null },
  orderPlacedAt: { type: Date, default: null },
  shippedAt: { type: Date, default: null },
  
  // Disbursement Fields
  disbursementStatus: {
    type: String,
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending"
  },
  payoutId: { type: String, default: null },
  payoutAmount: { type: Number, default: null },
  commissionAmount: { type: Number, default: null },
  disbursedAt: { type: Date, default: null },
  
  // Timestamps
  receiptUrl: { type: String, default: null },
  expiresAt: Date,
  paymentExpiresAt: { type: Date, default: null },      // 15 min after deal accepted
  addressExpiresAt: { type: Date, default: null },      // 15 min after payment
  orderExpiresAt: { type: Date, default: null },        // 15 min after address shared
  cancelledBy: { type: String, enum: ["buyer", "cardholder", "system"], default: null },
  cancelledAt: { type: Date, default: null },
  cancelReason: { type: String, default: null },
  settled: { type: Boolean, default: false },
  acceptedAt: { type: Date, default: null },
  paidAt: { type: Date, default: null },
  addressSharedAt: { type: Date, default: null }
}, { timestamps: true });

// Index for faster queries
DealSchema.index({ buyerId: 1, status: 1 });
DealSchema.index({ cardholderId: 1, status: 1 });
DealSchema.index({ status: 1, expiresAt: 1 });

export default mongoose.model("Deal", DealSchema);

