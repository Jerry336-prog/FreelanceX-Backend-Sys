import User from "../models/user.js";
import Job from "../models/job.js";
import Contract from "../models/contract.js";
import Payment from "../models/payment.js";

// 1. Get Platform Overview Stats
const getOverviewStats = async (req, res) => {
    try {
        const [
            totalUsers,
            totalFreelancers,
            totalClients,
            totalJobs,
            activeJobs,
            totalContracts,
            activeContracts,
            payments
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: "freelancer" }),
            User.countDocuments({ role: "client" }),
            Job.countDocuments(),
            Job.countDocuments({ status: "open" }),
            Contract.countDocuments(),
            Contract.countDocuments({ status: "active" }),
            Payment.find({ status: { $in: ["successful", "released"] } })
        ]);

        const totalVolume = payments.reduce((sum, p) => sum + p.amount, 0);

        return res.status(200).json({
            users: { total: totalUsers, freelancers: totalFreelancers, clients: totalClients },
            jobs: { total: totalJobs, active: activeJobs },
            contracts: { total: totalContracts, active: activeContracts },
            financials: { totalVolume }
        });
    } catch (error) {
        console.error("Get admin overview stats error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 2. Get Users with Filters & Search
const getAllAdminUsers = async (req, res) => {
    try {
        const { role, status, search, page = 1, limit = 20 } = req.query;
        const query = {};

        if (role && role !== "all") query.role = role;
        if (status && status !== "all") query.status = status;
        if (search) {
            query.$or = [
                { firstname: { $regex: search, $options: "i" } },
                { lastname: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [users, total] = await Promise.all([
            User.find(query).select("-password").sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
            User.countDocuments(query)
        ]);

        return res.status(200).json({ users, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (error) {
        console.error("Get all admin users error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 3. Toggle User Account Status (active/suspended/deactivated)
const toggleUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["active", "suspended", "deactivated"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const user = await User.findByIdAndUpdate(id, { status }, { new: true }).select("-password");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Log action in audit log
        await AuditLog.create({
            adminId: req.user.id,
            action: `USER_STATUS_CHANGE_${status.toUpperCase()}`,
            resourceType: "User",
            resourceId: user._id,
            description: `Admin changed status of ${user.email} to ${status}`
        });

        return res.status(200).json({ message: `User status updated to ${status}`, user });
    } catch (error) {
        console.error("Toggle user status error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 4. Get All Platform Jobs
const getAllAdminJobs = async (req, res) => {
    try {
        const { status } = req.query;
        const query = status ? { status } : {};

        const jobs = await Job.find(query)
            .populate("clientId", "firstname lastname email companyName")
            .sort({ createdAt: -1 });

        return res.status(200).json(jobs);
    } catch (error) {
        console.error("Get all admin jobs error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 5. Get All Platform Contracts
const getAllAdminContracts = async (req, res) => {
    try {
        const { status } = req.query;
        const query = status ? { status } : {};

        const contracts = await Contract.find(query)
            .populate("clientId", "firstname lastname email companyName")
            .populate("freelancerId", "firstname lastname email")
            .populate("jobId", "title category")
            .sort({ createdAt: -1 });

        return res.status(200).json(contracts);
    } catch (error) {
        console.error("Get all admin contracts error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 6. Get All Platform Payments
const getAllAdminPayments = async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate("clientId", "firstname lastname email")
            .populate("freelancerId", "firstname lastname email")
            .populate("contractId", "title")
            .sort({ createdAt: -1 });

        return res.status(200).json(payments);
    } catch (error) {
        console.error("Get all admin payments error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export {
    getOverviewStats,
    getAllAdminUsers,
    toggleUserStatus,
    getAllAdminJobs,
    getAllAdminContracts,
    getAllAdminPayments
};
