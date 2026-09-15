import Dispute from "../models/dispute.js";
import Contract from "../models/contract.js";
import Payment from "../models/payment.js";
import Notification from "../models/notification.js";

// 1. Open Dispute (Client or Freelancer)
const openDispute = async (req, res) => {
    try {
        const { contractId, reason, description, evidence } = req.body;

        if (!contractId || !reason || !description) {
            return res.status(400).json({ message: "Contract ID, reason, and description are required" });
        }

        const contract = await Contract.findById(contractId);
        if (!contract) {
            return res.status(404).json({ message: "Contract not found" });
        }

        const isParticipant = 
            contract.clientId.toString() === req.user.id || 
            contract.freelancerId.toString() === req.user.id;

        if (!isParticipant) {
            return res.status(403).json({ message: "Only contract participants can open a dispute" });
        }

        const dispute = await Dispute.create({
            contractId: contract._id,
            jobId: contract.jobId,
            openedBy: req.user.id,
            clientId: contract.clientId,
            freelancerId: contract.freelancerId,
            reason: reason.trim(),
            description: description.trim(),
            evidence: evidence || [],
            status: "open"
        });

        // Update contract status
        contract.status = "disputed";
        await contract.save();

        // Notify counterparty
        const recipientId = req.user.id === contract.clientId.toString() 
            ? contract.freelancerId 
            : contract.clientId;

        await Notification.create({
            userId: recipientId,
            type: "system",
            title: "Dispute Opened",
            message: `A dispute has been opened on contract "${contract.title}". An admin will review it.`,
            relatedId: dispute._id,
            relatedType: "Dispute"
        });

        return res.status(201).json({ message: "Dispute opened successfully", dispute });
    } catch (error) {
        console.error("Open dispute error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 2. Get All Disputes (Admin or User's own)
const getDisputes = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};

        if (req.user.role !== "admin") {
            filter.$or = [{ clientId: req.user.id }, { freelancerId: req.user.id }];
        }

        if (status) {
            filter.status = status;
        }

        const disputes = await Dispute.find(filter)
            .populate("clientId", "firstname lastname profileImage")
            .populate("freelancerId", "firstname lastname profileImage")
            .populate("contractId", "title agreedAmount status")
            .sort({ createdAt: -1 });

        return res.status(200).json(disputes);
    } catch (error) {
        console.error("Get disputes error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 3. Get Single Dispute Details
const getDisputeById = async (req, res) => {
    try {
        const { id } = req.params;

        const dispute = await Dispute.findById(id);

        if (!dispute) {
            return res.status(404).json({ message: "Dispute not found" });
        }

        const isParticipant = [dispute.clientId, dispute.freelancerId]
            .some((participantId) => participantId.toString() === req.user.id);
        if (req.user.role !== "admin" && !isParticipant) {
            return res.status(403).json({ message: "You do not have access to this dispute" });
        }

        await dispute.populate([
            { path: "clientId", select: "firstname lastname profileImage" },
            { path: "freelancerId", select: "firstname lastname profileImage" },
            { path: "contractId", select: "title agreedAmount status paymentStatus workSubmission" },
            { path: "openedBy", select: "firstname lastname role" }
        ]);

        return res.status(200).json(dispute);
    } catch (error) {
        console.error("Get dispute by ID error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 4. Admin Resolve Dispute
const resolveDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution, decision } = req.body; // decision: 'favor_client', 'favor_freelancer'

        const dispute = await Dispute.findById(id);
        if (!dispute) {
            return res.status(404).json({ message: "Dispute not found" });
        }

        dispute.status = "resolved";
        dispute.resolution = resolution || decision;
        dispute.adminId = req.user.id;
        dispute.resolvedAt = new Date();
        await dispute.save();

        // Update Contract and Payment based on decision
        if (decision === "favor_client") {
            await Contract.findByIdAndUpdate(dispute.contractId, {
                status: "cancelled",
                paymentStatus: "refunded"
            });
            await Payment.updateMany({ contractId: dispute.contractId }, { status: "refunded" });
        } else if (decision === "favor_freelancer") {
            await Contract.findByIdAndUpdate(dispute.contractId, {
                status: "completed",
                paymentStatus: "released"
            });
            await Payment.updateMany({ contractId: dispute.contractId }, {
                status: "released",
                releasedAt: new Date()
            });
        }

        // Notify both parties
        await Promise.all([
            Notification.create({
                userId: dispute.clientId,
                type: "system",
                title: "Dispute Resolved",
                message: `The dispute for contract has been resolved by Admin: ${resolution || decision}`,
                relatedId: dispute._id,
                relatedType: "Dispute"
            }),
            Notification.create({
                userId: dispute.freelancerId,
                type: "system",
                title: "Dispute Resolved",
                message: `The dispute for contract has been resolved by Admin: ${resolution || decision}`,
                relatedId: dispute._id,
                relatedType: "Dispute"
            })
        ]);

        return res.status(200).json({ message: "Dispute resolved successfully", dispute });
    } catch (error) {
        console.error("Resolve dispute error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export {
    openDispute,
    getDisputes,
    getDisputeById,
    resolveDispute
};
