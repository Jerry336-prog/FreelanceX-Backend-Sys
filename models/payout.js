import mongoose from "mongoose";
const Schema = mongoose.Schema;

const payoutSchema = new Schema({
  freelancerId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: "NGN"
  },
  // Payout destination (snapshot of account at time of request)
  accountName: {
    type: String,
    required: true
  },
  accountNumber: {
    type: String,
    required: true
  },
  bankCode: {
    type: String,
    required: true
  },
  bankName: {
    type: String,
    required: true
  },
  // Paystack Transfer details
  recipientCode: {
    type: String,
    default: null
  },
  transferCode: {
    type: String,
    default: null
  },
  paystackTransferId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ["pending", "processing", "success", "failed", "reversed"],
    default: "pending"
  },
  failureReason: {
    type: String,
    default: null
  },
  processedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

const Payout = mongoose.model("Payout", payoutSchema);

export default Payout;
