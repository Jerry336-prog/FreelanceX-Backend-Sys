import mongoose from "mongoose";
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: ["message", "proposal", "contract", "payment", "system"],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedId: {
    type: Schema.Types.ObjectId,
    default: null
  },
  relatedType: {
    type: String,
    default: null
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, { timestamps: { createdAt: true, updatedAt: false } });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
