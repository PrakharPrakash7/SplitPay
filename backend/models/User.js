import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, enum: ["buyer", "cardholder"], required: true },
  firebaseUid: { type: String },
  fcmToken: { type: String, default: null },
  creditCards: [{
    bank: { type: String }, // HDFC, ICICI, SBI, etc.
    cardType: { type: String, default: 'credit' }, // credit/debit
    lastFourDigits: { type: String } // Optional: last 4 digits for identification
  }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", userSchema);
