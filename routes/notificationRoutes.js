import express from "express";
import {
    getMyNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
} from "../controllers/notificationControllers.js";
import authorise from "../middleware/authorise.js";

const router = express.Router();

// Get user notifications & unread count
router.get("/", authorise(['freelancer', 'client', 'admin']), getMyNotifications);

// Mark single notification as read
router.patch("/:id/read", authorise(['freelancer', 'client', 'admin']), markAsRead);

// Mark all notifications as read
router.patch("/read-all", authorise(['freelancer', 'client', 'admin']), markAllAsRead);

// Delete notification
router.delete("/:id", authorise(['freelancer', 'client', 'admin']), deleteNotification);

export default router;
