import mongoose from "mongoose";
const Schema = mongoose.Schema;

const jobSchema = new Schema({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  skills: [{
    type: String,
    trim: true
  }],
  budget: {
    type: Number,
    required: true
  },
  budgetType: {
    type: String,
    enum: ["fixed", "hourly"],
    required: true
  },
  jobType: {
    type: String,
    enum: ["remote", "onsite", "hybrid"],
    default: "remote"
  },
  deadline: {
    type: Date,
    default: null
  },
  attachments: [{
    type: String
  }],
  status: {
    type: String,
    enum: ["draft", "open", "in_progress", "completed", "closed", "cancelled"],
    default: "open"
  },
  proposalCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const Job = mongoose.model("Job", jobSchema);

export default Job;
