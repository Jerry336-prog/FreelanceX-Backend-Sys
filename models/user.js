import mongoose from "mongoose";
const Schema = mongoose.Schema;

const userSchema = new Schema({
  firstname: {
    type: String,
    required: true,
    trim: true
  },
  lastname: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  githubId: {
    type: String,
    unique: true,
    sparse: true
  },
  role: {
    type: String,
    enum: ["freelancer", "client", "admin"],
    default: "client"
  },
  profileImage: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    default: null
  },
  location: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    default: null
  },
  // Client Specific Fields
  companyName: {
    type: String,
    default: null,
    trim: true
  },
  website: {
    type: String,
    default: null
  },
  // Freelancer Specific Fields
  professionalTitle: {
    type: String,
    default: null,
    trim: true
  },
  skills: [{
    type: String,
    trim: true
  }],
  hourlyRate: {
    type: Number,
    default: null
  },
  availability: {
    type: String,
    enum: ["available", "unavailable", "part_time"],
    default: "available"
  },
  experience: {
    type: String,
    enum: ["entry", "intermediate", "expert"],
    default: "entry"
  },
  portfolio: [{
    title: { type: String },
    link: { type: String },
    description: { type: String }
  }],
  // Stats & Performance
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  completedJobs: {
    type: Number,
    default: 0
  },
  // Account Status
  status: {
    type: String,
    enum: ["active", "suspended", "deactivated"],
    default: "active"
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  // Becomes true once the user saves their role-specific account/profile setup.
  // This lets the app consistently prompt incomplete accounts after sign-in.
  profileSetupCompleted: {
    type: Boolean,
    default: false
  },
  payoutAccount: {
    accountName: { type: String, default: null },
    accountNumber: { type: String, default: null },
    bankCode: { type: String, default: null },
    bankName: { type: String, default: null },
    recipientCode: { type: String, default: null },
    verifiedAt: { type: Date, default: null }
  }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

export default User;
