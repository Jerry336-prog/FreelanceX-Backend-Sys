import mongoose from "mongoose";
const Schema = mongoose.Schema;

const disputeSchema = new Schema({
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
  openedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
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
  reason: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  evidence: [{
    type: String
  }],
  status: {
    type: String,
    enum: ["open", "under_review", "resolved", "rejected"],
    default: "open"
  },
  adminId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  resolution: {
    type: String,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

const Dispute = mongoose.model("Dispute", disputeSchema);

export default Dispute;
