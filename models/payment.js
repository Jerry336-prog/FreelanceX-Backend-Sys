import mongoose from "mongoose";
const Schema = mongoose.Schema;

const paymentSchema = new Schema({
  contractId: {
    type: Schema.Types.ObjectId,
    ref: "Contract",
    required: true
  },
  jobId: {
    type: Schema.Types.ObjectId,
    ref: "Job",
    required: true
  },
  clientId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
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
  status: {
    type: String,
    enum: ["pending", "processing", "successful", "failed", "refunded"],
    default: "pending"
  },
  paymentMethod: {
    type: String,
    default: null
  },
  transactionReference: {
    type: String,
    default: null,
    unique: true,
    sparse: true
  },
  provider: {
    type: String,
    default: null
  },
  authorizationUrl: {
    type: String,
    default: null
  },
  accessCode: {
    type: String,
    default: null
  },
  providerTransactionId: {
    type: String,
    default: null
  },
  gatewayResponse: {
    type: String,
    default: null
  },
  channel: {
    type: String,
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  paidAt: {
    type: Date,
    default: null
  },
  releasedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
