import jwt from 'jsonwebtoken';
import User from '../models/user.js';

const authorise = (allowedRoles = ['freelancer', 'client', 'admin']) => async (req, res, next) => {
    try {
        let token = req.cookies?.token || (req.headers?.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

        if (!token) {
            return res.status(401).json({ message: "Access denied. Please login" });
        }

        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        const user = await User.findById(decoded.id).select('_id role status');

        if (!user) {
            return res.status(401).json({ message: "Account no longer exists. Please login again" });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ message: "This account is not active" });
        }

        req.user = { id: user._id.toString(), role: user.role };

        if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "Access denied. Insufficient permissions" });
        }

        next(); 
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: "Token expired. Please login again" });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: "Invalid authentication token." });
        } 
        return res.status(401).json({ message: "Authentication failed." });
    }
};

export default authorise;
