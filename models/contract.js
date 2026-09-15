import mongoose from "mongoose";
const Schema = mongoose.Schema;

const contractSchema = new Schema({
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
  proposalId: {
    type: Schema.Types.ObjectId,
    ref: "Proposal",
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  agreedAmount: {
    type: Number,
    required: true
  },
  budgetType: {
    type: String,
    enum: ["fixed", "hourly"],
    required: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  deadline: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ["active", "submitted", "revision_requested", "completed", "cancelled", "disputed"],
    default: "active"
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  workSubmission: {
    type: String,
    default: null
  },
  deliveryHistory: [{
    description: { type: String, required: true },
    stagingUrl: { type: String, default: null },
    files: [{ type: String }],
    submittedAt: { type: Date, required: true },
    updatedAt: { type: Date, default: null }
  }],
  paymentStatus: {
    type: String,
    enum: ["unpaid", "payment_sent", "paid", "refunded"],
    default: "unpaid"
  },
  freelancerConfirmedPayment: {
    type: Boolean,
    default: false
  },
  paymentConfirmedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

const Contract = mongoose.model("Contract", contractSchema);

export default Contract;
