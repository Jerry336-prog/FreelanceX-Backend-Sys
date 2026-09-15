import Contract from "../models/contract.js";
import Job from "../models/job.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";
import Conversation from "../models/conversation.js";
import Message from "../models/message.js";

// 1. Get Logged-in User's Contracts (Freelancer or Client)
const getMyContracts = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = req.user.role === "freelancer" 
            ? { freelancerId: req.user.id }
            : { clientId: req.user.id };

        if (status) filter.status = status;

        const contracts = await Contract.find(filter)
            .populate("freelancerId", "firstname lastname location profileImage professionalTitle")
            .populate("clientId", "firstname lastname companyName location profileImage")
            .populate("jobId", "title category budget budgetType")
            .sort({ createdAt: -1 });

        return res.status(200).json(contracts);
    } catch (error) {
        console.error("Get my contracts error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 2. Get Single Contract Details
const getContractById = async (req, res) => {
    try {
        const { id } = req.params;

        const contract = await Contract.findById(id)
            .populate("freelancerId", "firstname lastname location profileImage professionalTitle rating totalReviews")
            .populate("clientId", "firstname lastname companyName location profileImage")
            .populate("jobId", "title description category budget budgetType");

        if (!contract) {
            return res.status(404).json({ message: "Contract not found" });
        }

        // Verify authorization
        const isParticipant = 
            contract.freelancerId._id.toString() === req.user.id ||
            contract.clientId._id.toString() === req.user.id ||
            req.user.role === "admin";

        if (!isParticipant) {
            return res.status(403).json({ message: "Unauthorized to view this contract" });
        }

        return res.status(200).json(contract);
    } catch (error) {
        console.error("Get contract by ID error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 3. Submit Work (Freelancer)
const submitWork = async (req, res) => {
    try {
        const { id } = req.params;
        const { description, stagingUrl, files } = req.body;

        if (!description) {
            return res.status(400).json({ message: "Work description is required" });
        }

        const contract = await Contract.findById(id);
        if (!contract) {
            return res.status(404).json({ message: "Contract not found" });
        }

        if (contract.freelancerId.toString() !== req.user.id) {
            return res.status(403).json({ message: "Only the assigned freelancer can submit work" });
        }
        if (contract.status !== "active") {
            return res.status(409).json({
                message: "The initial delivery can only be submitted while this contract is active. Use delivery update for an existing delivery."
            });
        }

        const workData = {
            description: description.trim(),
            stagingUrl: stagingUrl || null,
            files: files || (req.files ? req.files.map(f => f.path) : []),
            submittedAt: new Date()
        };

        contract.workSubmission = JSON.stringify(workData);
        contract.deliveryHistory.push(workData);
        contract.status = "submitted";
        contract.progress = 100;
        await contract.save();

        // Notify Client
        await Notification.create({
            userId: contract.clientId,
            type: "contract",
            title: "Work Submitted for Review",
            message: `Freelancer submitted work for "${contract.title}". Please review and approve.`,
            relatedId: contract._id,
            relatedType: "Contract"
        });

        return res.status(200).json({ message: "Work submitted successfully", contract });
    } catch (error) {
        console.error("Submit work error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const updateDelivery = async (req, res) => {
    try {
        const { id } = req.params;
        const { description, stagingUrl, files } = req.body;

        if (!description?.trim()) {
            return res.status(400).json({ message: "Work description is required" });
        }

        const contract = await Contract.findById(id);
        if (!contract) {
            return res.status(404).json({ message: "Contract not found" });
        }
        if (contract.freelancerId.toString() !== req.user.id) {
            return res.status(403).json({ message: "Only the assigned freelancer can update this delivery" });
        }
        if (!['submitted', 'revision_requested'].includes(contract.status) || !contract.workSubmission) {
            return res.status(409).json({ message: "This delivery cannot be updated in the contract's current state" });
        }

        const workData = {
            description: description.trim(),
            stagingUrl: stagingUrl || null,
            files: files || (req.files ? req.files.map(f => f.path) : []),
            submittedAt: new Date(),
            updatedAt: new Date()
        };

        contract.workSubmission = JSON.stringify(workData);
        contract.deliveryHistory.push(workData);
        contract.status = "submitted";
        contract.progress = 100;
        await contract.save();

        await Notification.create({
            userId: contract.clientId,
            type: "contract",
            title: "Delivery Updated for Review",
            message: `Freelancer updated the delivery for "${contract.title}". Please review the latest version.`,
            relatedId: contract._id,
            relatedType: "Contract"
        });

        return res.status(200).json({ message: "Delivery updated successfully", contract });
    } catch (error) {
        console.error("Update delivery error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 5. Approve Submitted Work (Client)
const approveWork = async (req, res) => {
    try {
        const { id } = req.params;

        const contract = await Contract.findById(id);
        if (!contract) {
            return res.status(404).json({ message: "Contract not found" });
        }

        if (contract.clientId.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Only the client can approve submitted work" });
        }
        if (contract.status !== "submitted") {
            return res.status(409).json({ message: "Only a submitted delivery can be approved" });
        }

        contract.status = "completed";
        contract.paymentStatus = "unpaid";
        await contract.save();

        // Update Job status
        await Job.findByIdAndUpdate(contract.jobId, { status: "completed" });

        // Increment completedJobs counter for both user profiles
        await Promise.all([
            User.findByIdAndUpdate(contract.freelancerId, { $inc: { completedJobs: 1 } }),
            User.findByIdAndUpdate(contract.clientId, { $inc: { completedJobs: 1 } })
        ]);

        await Notification.create({
            userId: contract.freelancerId,
            type: "contract",
            title: "Work Approved",
            message: `Your delivery for "${contract.title}" was approved. Payment is pending the client's payment action.`,
            relatedId: contract._id,
            relatedType: "Contract"
        });

        return res.status(200).json({ message: "Work approved successfully. Payment is pending.", contract });
    } catch (error) {
        console.error("Approve work error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 6. Request Revision (Client)
const requestRevision = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const contract = await Contract.findById(id);
        if (!contract) {
            return res.status(404).json({ message: "Contract not found" });
        }

        if (contract.clientId.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Only the client can request revisions" });
        }
        if (contract.status !== "submitted") {
            return res.status(409).json({ message: "A revision can only be requested for a submitted delivery" });
        }

        contract.status = "revision_requested";
        contract.progress = 90;
        await contract.save();

        const revisionInstructions = notes?.trim() || "Please review the submitted work and resubmit the requested updates.";
        const revisionMessage = `Revision requested for "${contract.title}": ${revisionInstructions}`;

        let conversation = await Conversation.findOne({
            participants: { $all: [contract.clientId, contract.freelancerId], $size: 2 }
        });

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [contract.clientId, contract.freelancerId],
                contractId: contract._id,
                jobId: contract.jobId
            });
        }

        await Message.create({
            conversationId: conversation._id,
            senderId: contract.clientId,
            receiverId: contract.freelancerId,
            message: revisionMessage,
            read: false
        });

        await Conversation.findByIdAndUpdate(conversation._id, {
            $set: { lastMessage: revisionMessage, lastMessageAt: new Date() },
            $pull: { deletedFor: { $in: [contract.clientId, contract.freelancerId] } }
        });

        // Notify Freelancer as well, so the request is visible outside chat.
        await Notification.create({
            userId: contract.freelancerId,
            type: "contract",
            title: "Revision Requested",
            message: revisionMessage,
            relatedId: contract._id,
            relatedType: "Contract"
        });

        return res.status(200).json({ message: "Revision requested successfully", contract });
    } catch (error) {
        console.error("Request revision error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 7. Cancel Contract
const cancelContract = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const contract = await Contract.findById(id);
        if (!contract) {
            return res.status(404).json({ message: "Contract not found" });
        }

        const isOwner = contract.clientId.toString() === req.user.id || req.user.role === "admin";
        if (!isOwner) {
            return res.status(403).json({ message: "Unauthorized to cancel this contract" });
        }
        if (!['active', 'submitted', 'revision_requested'].includes(contract.status)) {
            return res.status(409).json({ message: "This contract can no longer be cancelled" });
        }

        contract.status = "cancelled";
        contract.paymentStatus = "refunded";
        await contract.save();

        await Job.findByIdAndUpdate(contract.jobId, { status: "cancelled" });

        return res.status(200).json({ message: "Contract cancelled and funds refunded", contract });
    } catch (error) {
        console.error("Cancel contract error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 8. Freelancer Confirm Payment Received
const confirmPayment = async (req, res) => {
    try {
        const { id } = req.params;

        const contract = await Contract.findById(id);
        if (!contract) {
            return res.status(404).json({ message: "Contract not found" });
        }

        if (contract.freelancerId.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Only the freelancer can confirm payment receipt" });
        }

        contract.paymentStatus = "paid";
        contract.freelancerConfirmedPayment = true;
        contract.paymentConfirmedAt = new Date();
        await contract.save();

        const messageText = `Payment Confirmed: Freelancer confirmed receipt of ₦${Number(contract.agreedAmount || 0).toLocaleString()} for contract "${contract.title}".`;

        let conversation = await Conversation.findOne({
            participants: { $all: [contract.clientId, contract.freelancerId], $size: 2 }
        });

        if (conversation) {
            await Message.create({
                conversationId: conversation._id,
                senderId: contract.freelancerId,
                receiverId: contract.clientId,
                message: messageText,
                read: false
            });
            await Conversation.findByIdAndUpdate(conversation._id, {
                $set: { lastMessage: messageText, lastMessageAt: new Date() },
                $pull: { deletedFor: { $in: [contract.clientId, contract.freelancerId] } }
            });
        }

        await Notification.create({
            userId: contract.clientId,
            type: "payment",
            title: "Payment Confirmed by Freelancer",
            message: messageText,
            relatedId: contract._id,
            relatedType: "Contract"
        });

        return res.status(200).json({ message: "Payment confirmed successfully", contract });
    } catch (error) {
        console.error("Confirm payment error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export {
    getMyContracts,
    getContractById,
    submitWork,
    updateDelivery,
    approveWork,
    requestRevision,
    cancelContract,
    confirmPayment
};
