import mongoose from "mongoose";
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  conversationId: {
    type: Schema.Types.ObjectId,
    ref: "Conversation",
    required: true
  },
  senderId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  receiverId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  message: {
    type: String,
    required: true
  },
  attachments: [{
    type: Schema.Types.Mixed
  }],
  read: {
    type: Boolean,
    default: false
  }
}, { timestamps: { createdAt: true, updatedAt: false } });

const Message = mongoose.model("Message", messageSchema);

export default Message;
