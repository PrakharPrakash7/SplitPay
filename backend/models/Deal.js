import mongoose from "mongoose";

const DealSchema = new mongoose.Schema({
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  product: {
    title: String,
    image: String,
    price: Number,
    url: String
  },
  discountPct: { type: Number, default: 10 },
  discountedPrice: Number,
  status: { type: String, enum: ["pending","matched","completed","expired","failed"], default: "pending" },
  cardholderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  receiptUrl: { type: String, default: null },
  expiresAt: Date,
  settled: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("Deal", DealSchema);
