import express from "express";
import {
    getConversations,
    getOrCreateConversation,
    getMessages,
    sendMessage,
    markConversationRead,
    deleteConversation
} from "../controllers/messageControllers.js";
import authorise from "../middleware/authorise.js";
import { uploadDocuments } from "../middleware/upload.js";

const router = express.Router();

// Get list of conversations
router.get("/conversations", authorise(['freelancer', 'client', 'admin']), getConversations);

// Create or get conversation with another user
router.post("/conversations", authorise(['freelancer', 'client', 'admin']), getOrCreateConversation);

// Hide a conversation from the current user's inbox.
router.delete("/conversations/:conversationId", authorise(['freelancer', 'client', 'admin']), deleteConversation);

// Get messages for a specific conversation
router.get("/conversations/:conversationId/messages", authorise(['freelancer', 'client', 'admin']), getMessages);

// Send message (accepts text and optional uploaded files)
router.post("/messages", authorise(['freelancer', 'client', 'admin']), uploadDocuments.array("files", 5), sendMessage);

router.patch("/conversations/:conversationId/read", authorise(['freelancer', 'client', 'admin']), markConversationRead);

export default router;
