import mongoose from "mongoose";
import Conversation from "../models/conversation.js";
import Message from "../models/message.js";
import Notification from "../models/notification.js";
import User from "../models/user.js";

const participantKey = (participantIds) =>
    participantIds
        .map((id) => (id && (id._id || id.id || id)).toString())
        .sort()
        .join(":");

// Older records may have been created simultaneously before a unique pair key
// existed. Merge those duplicate threads into the newest one once encountered.
const mergeDuplicateConversations = async (conversations) => {
    const grouped = new Map();
    conversations.forEach((conversation) => {
        const key = participantKey(conversation.participants);
        grouped.set(key, [...(grouped.get(key) || []), conversation]);
    });

    const merged = [];
    for (const group of grouped.values()) {
        if (group.length === 1) {
            merged.push(group[0]);
            continue;
        }

        group.sort((a, b) => new Date(b.lastMessageAt || b.updatedAt || b.createdAt) - new Date(a.lastMessageAt || a.updatedAt || a.createdAt));
        const primary = group[0];
        const duplicates = group.slice(1);
        const deletedForSets = group.map((conversation) => new Set((conversation.deletedFor || []).map((id) => id.toString())));
        primary.deletedFor = [...deletedForSets.reduce((intersection, current) => new Set([...intersection].filter((id) => current.has(id))))];

        await Message.updateMany(
            { conversationId: { $in: duplicates.map((conversation) => conversation._id) } },
            { $set: { conversationId: primary._id } }
        );
        await Conversation.deleteMany({ _id: { $in: duplicates.map((conversation) => conversation._id) } });
        await primary.save();
        merged.push(primary);
    }
    return merged;
};

// 1. Get Logged-in User's Conversations
const getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user.id,
            deletedFor: { $ne: req.user.id }
        })
            .populate("participants", "firstname lastname role profileImage")
            .sort({ lastMessageAt: -1, updatedAt: -1 });

        const uniqueConversations = await mergeDuplicateConversations(conversations);
        const withUnreadCounts = await Promise.all(uniqueConversations.map(async (conversation) => ({
            ...conversation.toObject(),
            unreadCount: await Message.countDocuments({
                conversationId: conversation._id,
                receiverId: req.user.id,
                read: false
            })
        })));
        return res.status(200).json(withUnreadCounts);
    } catch (error) {
        console.error("Get conversations error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 2. Start or Get Existing Conversation
const getOrCreateConversation = async (req, res) => {
    try {
        const { recipientId, contractId, jobId } = req.body;

        if (!recipientId || recipientId === "undefined" || recipientId === "null" || !mongoose.Types.ObjectId.isValid(recipientId)) {
            return res.status(400).json({ message: "A valid recipient ID is required" });
        }
        const myObjectId = new mongoose.Types.ObjectId(req.user.id);
        const recipientObjectId = new mongoose.Types.ObjectId(recipientId);

        // Handle self-messaging gracefully for test accounts & preview modes
        if (recipientId.toString() === req.user.id.toString()) {
            let selfConv = await Conversation.findOne({
                participants: [myObjectId]
            }).populate("participants", "firstname lastname role profileImage");

            if (!selfConv) {
                const created = await Conversation.create({
                    participants: [myObjectId],
                    participantsKey: `${req.user.id}:${req.user.id}`,
                    contractId: contractId && mongoose.Types.ObjectId.isValid(contractId) ? new mongoose.Types.ObjectId(contractId) : null,
                    jobId: jobId && mongoose.Types.ObjectId.isValid(jobId) ? new mongoose.Types.ObjectId(jobId) : null
                });
                selfConv = await Conversation.findById(created._id)
                    .populate("participants", "firstname lastname role profileImage");
            }
            return res.status(200).json(selfConv);
        }

        let recipient = await User.findById(recipientId).select("_id status firstname lastname role profileImage");
        if (recipient && (recipient.status === "suspended" || recipient.status === "deactivated")) {
            return res.status(400).json({ message: "This user is currently unavailable for messaging" });
        }

        const validContractId = contractId && mongoose.Types.ObjectId.isValid(contractId) ? new mongoose.Types.ObjectId(contractId) : null;
        const validJobId = jobId && mongoose.Types.ObjectId.isValid(jobId) ? new mongoose.Types.ObjectId(jobId) : null;

        const key = participantKey([myObjectId, recipientObjectId]);

        // 1. Search by participantsKey or by participants array with ObjectId instances
        let conversation = await Conversation.findOne({
            $or: [
                { participantsKey: key },
                { participants: { $all: [myObjectId, recipientObjectId] } }
            ]
        }).populate("participants", "firstname lastname role profileImage");

        // 2. Create if not existing
        if (!conversation) {
            try {
                const created = await Conversation.create({
                    participants: [myObjectId, recipientObjectId],
                    participantsKey: key,
                    contractId: validContractId,
                    jobId: validJobId
                });
                conversation = await Conversation.findById(created._id)
                    .populate("participants", "firstname lastname role profileImage");
            } catch (createErr) {
                console.error("Conversation creation error:", createErr);
                conversation = await Conversation.findOne({
                    $or: [
                        { participantsKey: key },
                        { participants: { $all: [myObjectId, recipientObjectId] } }
                    ]
                }).populate("participants", "firstname lastname role profileImage");
            }
        }

        if (!conversation) {
            return res.status(400).json({ message: "Could not initialize conversation thread with this user" });
        }

        // Unhide conversation if it was deleted for current user
        if (conversation.deletedFor && conversation.deletedFor.map(id => id.toString()).includes(req.user.id.toString())) {
            await Conversation.findByIdAndUpdate(conversation._id, {
                $pull: { deletedFor: req.user.id }
            });
        }

        // Ensure participantsKey is saved if missing on legacy document
        if (!conversation.participantsKey) {
            await Conversation.findByIdAndUpdate(conversation._id, {
                $set: { participantsKey: key }
            });
        }

        return res.status(200).json(conversation);
    } catch (error) {
        console.error("Get/Create conversation error:", error);
        return res.status(500).json({ message: error?.message || "Internal server error" });
    }
};

// 3. Get Messages in a Conversation
const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        if (!conversation.participants.map(p => p.toString()).includes(req.user.id)) {
            return res.status(403).json({ message: "Unauthorized access to this conversation" });
        }

        const messages = await Message.find({ conversationId })
            .populate("senderId", "firstname lastname profileImage")
            .sort({ createdAt: 1 });

        await Message.updateMany(
            { conversationId, receiverId: req.user.id, read: false },
            { $set: { read: true } }
        );

        return res.status(200).json(messages);
    } catch (error) {
        console.error("Get messages error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 4. Send Message
const sendMessage = async (req, res) => {
    try {
        const { conversationId, receiverId, message, attachments } = req.body;

        let messageAttachments = [];
        if (req.files && req.files.length > 0) {
            messageAttachments = req.files.map(f => f.path || f.location);
        } else if (attachments) {
            try {
                messageAttachments = typeof attachments === 'string' ? JSON.parse(attachments) : attachments;
            } catch {
                messageAttachments = Array.isArray(attachments) ? attachments : [attachments];
            }
        }

        const messageContent = (message || '').trim() || (messageAttachments.length > 0 ? "📎 Attached file(s)" : "");

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });

        const participantIds = conversation.participants.map((participant) => (participant && (participant._id || participant.id || participant)).toString());
        if (!participantIds.includes(req.user.id)) {
            return res.status(403).json({ message: "Unauthorized conversation participant" });
        }

        // Infer target receiverId if not explicitly provided or if self-chat
        const targetReceiverId = receiverId || participantIds.find(id => id !== req.user.id) || req.user.id;

        if (!messageContent) {
            return res.status(400).json({ message: "Message content or attachments are required" });
        }

        const receiver = await User.findById(targetReceiverId).select("_id status");
        if (receiver && (receiver.status === "suspended" || receiver.status === "deactivated")) {
            return res.status(400).json({ message: "This recipient is currently unavailable for messaging" });
        }

        const newMessage = await Message.create({
            conversationId,
            senderId: req.user.id,
            receiverId: targetReceiverId,
            message: messageContent,
            attachments: messageAttachments
        });

        // Update Conversation last message
        await Conversation.findByIdAndUpdate(conversationId, {
            $set: { lastMessage: messageContent, lastMessageAt: new Date() },
            $pull: { deletedFor: { $in: [req.user.id, targetReceiverId] } }
        });

        // Notify Receiver
        await Notification.create({
            userId: targetReceiverId,
            type: "message",
            title: "New Message",
            message: messageContent.length > 60 ? `${messageContent.substring(0, 60)}...` : messageContent,
            relatedId: conversationId,
            relatedType: "Conversation"
        });

        const populatedMessage = await Message.findById(newMessage._id)
            .populate("senderId", "firstname lastname profileImage");

        return res.status(201).json({ message: "Message sent", data: populatedMessage });
    } catch (error) {
        console.error("Send message error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const markConversationRead = async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.conversationId);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });
        if (!conversation.participants.map((participant) => participant.toString()).includes(req.user.id)) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        await Message.updateMany(
            { conversationId: conversation._id, receiverId: req.user.id, read: false },
            { $set: { read: true } }
        );
        return res.status(200).json({ message: "Marked as read" });
    } catch (error) {
        console.error("Mark read error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const deleteConversation = async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.conversationId);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });
        if (!conversation.participants.map((participant) => participant.toString()).includes(req.user.id)) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        await Conversation.findByIdAndUpdate(conversation._id, {
            $addToSet: { deletedFor: req.user.id }
        });
        return res.status(200).json({ message: "Conversation deleted from your inbox" });
    } catch (error) {
        console.error("Delete conversation error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export {
    getConversations,
    getOrCreateConversation,
    getMessages,
    sendMessage,
    markConversationRead,
    deleteConversation
};
