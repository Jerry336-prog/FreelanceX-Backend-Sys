import mongoose from "mongoose";
const Schema = mongoose.Schema;

const proposalSchema = new Schema({
  jobId: {
    type: Schema.Types.ObjectId,
    ref: "Job",
    required: true
  },
  freelancerId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  coverLetter: {
    type: String,
    required: true
  },
  bidAmount: {
    type: Number,
    required: true
  },
  deliveryTime: {
    type: Number,
    required: true,
    comment: "Delivery time in days"
  },
  attachments: [{
    type: String
  }],
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "withdrawn"],
    default: "pending"
  }
}, { timestamps: true });

// A freelancer can have only one application for a job. This is enforced in
// MongoDB as well as in the controller so concurrent requests cannot duplicate it.
proposalSchema.index({ jobId: 1, freelancerId: 1 }, { unique: true });

const Proposal = mongoose.model("Proposal", proposalSchema);

export default Proposal;
