import mongoose from "mongoose";
const Schema = mongoose.Schema;

const conversationSchema = new Schema({
  participants: [{
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  }],
  // Canonical pair identifier. One direct chat is allowed per two users.
  participantsKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  contractId: {
    type: Schema.Types.ObjectId,
    ref: "Contract",
    default: null
  },
  jobId: {
    type: Schema.Types.ObjectId,
    ref: "Job",
    default: null
  },
  lastMessage: {
    type: String,
    default: null
  },
  lastMessageAt: {
    type: Date,
    default: null
  },
  deletedFor: [{
    type: Schema.Types.ObjectId,
    ref: "User"
  }]
}, { timestamps: true });

conversationSchema.pre("validate", async function () {
  if (Array.isArray(this.participants) && this.participants.length === 2) {
    this.participantsKey = this.participants
      .map((participant) => (participant && (participant._id || participant.id || participant)).toString())
      .sort()
      .join(":");
  }
});

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
