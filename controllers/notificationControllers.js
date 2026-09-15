import Notification from "../models/notification.js";

// 1. Get Logged-in User's Notifications
const getMyNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({ 
            userId: req.user.id, 
            isRead: false 
        });

        return res.status(200).json({ notifications, unreadCount });
    } catch (error) {
        console.error("Get notifications error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 2. Mark Single Notification as Read
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, userId: req.user.id },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        return res.status(200).json({ message: "Notification marked as read", notification });
    } catch (error) {
        console.error("Mark notification read error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 3. Mark All User Notifications as Read
const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.user.id, isRead: false },
            { isRead: true }
        );

        return res.status(200).json({ message: "All notifications marked as read" });
    } catch (error) {
        console.error("Mark all read error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 4. Delete Notification
const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findOneAndDelete({
            _id: id,
            userId: req.user.id
        });

        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        return res.status(200).json({ message: "Notification deleted successfully" });
    } catch (error) {
        console.error("Delete notification error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export {
    getMyNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
};
