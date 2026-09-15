import Proposal from "../models/proposal.js";
import Job from "../models/job.js";
import Contract from "../models/contract.js";
import Notification from "../models/notification.js";

// 1. Submit Proposal (Freelancer)
const submitProposal = async (req, res) => {
    try {
        const { jobId, coverLetter, bidAmount, deliveryTime, attachments } = req.body;

        if (!jobId || !coverLetter || !bidAmount || !deliveryTime) {
            return res.status(400).json({ message: "Job ID, cover letter, bid amount, and delivery time are required" });
        }

        // Check if freelancer already submitted
        const existing = await Proposal.findOne({ jobId, freelancerId: req.user.id });
        if (existing) {
            return res.status(409).json({ message: "You have already applied for this job" });
        }

        // This marketplace accepts one application per job. Claim and close
        // the listing atomically before creating the proposal, preventing
        // another freelancer from applying during the same moment.
        const job = await Job.findOneAndUpdate(
            { _id: jobId, status: "open" },
            { $set: { status: "closed" }, $inc: { proposalCount: 1 } },
            { new: true }
        );
        if (!job) {
            return res.status(409).json({ message: "This job has already received an application and is closed" });
        }

        let proposal;
        try {
            proposal = await Proposal.create({
                jobId,
                freelancerId: req.user.id,
                coverLetter: coverLetter.trim(),
                bidAmount: Number(bidAmount),
                deliveryTime: Number(deliveryTime) || 7,
                attachments: req.files && req.files.length > 0
                    ? req.files.map((file) => file.path || file.secure_url)
                    : (Array.isArray(attachments) ? attachments : (attachments ? [attachments] : []))
            });
        } catch (error) {
            // Do not leave a listing closed if saving its only application fails.
            await Job.findByIdAndUpdate(jobId, { $set: { status: "open" }, $inc: { proposalCount: -1 } });
            if (error?.code === 11000) {
                return res.status(409).json({ message: "You have already applied for this job" });
            }
            throw error;
        }

        // Notify Job Client
        await Notification.create({
            userId: job.clientId,
            type: "proposal",
            title: "New Proposal Received",
            message: `A freelancer submitted a proposal for "${job.title}"`,
            relatedId: proposal._id,
            relatedType: "Proposal"
        });

        return res.status(201).json({ message: "Proposal submitted successfully", proposal });
    } catch (error) {
        console.error("Submit proposal error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 2. Get Proposals for a Specific Job (Client only)
const getJobProposals = async (req, res) => {
    try {
        const { jobId } = req.params;

        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (job.clientId.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Unauthorized access to job proposals" });
        }

        const proposals = await Proposal.find({ jobId })
            .populate("freelancerId", "firstname lastname location professionalTitle rating totalReviews completedJobs profileImage skills hourlyRate")
            .sort({ createdAt: -1 });

        return res.status(200).json(proposals);
    } catch (error) {
        console.error("Get job proposals error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 3. Get Logged-in Freelancer's Proposals
const getMyProposals = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = { freelancerId: req.user.id };
        if (status) filter.status = status;

        const proposals = await Proposal.find(filter)
            .populate({
                path: "jobId",
                populate: { path: "clientId", select: "firstname lastname companyName location" }
            })
            .sort({ createdAt: -1 });

        return res.status(200).json(proposals);
    } catch (error) {
        console.error("Get my proposals error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 4. Accept Proposal & Create Contract (Client)
const acceptProposal = async (req, res) => {
    try {
        const { id } = req.params; // proposal id

        const proposal = await Proposal.findById(id).populate("jobId");
        if (!proposal) {
            return res.status(404).json({ message: "Proposal not found" });
        }

        const job = proposal.jobId;
        if (job.clientId.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Unauthorized to accept this proposal" });
        }

        // Update proposal status
        proposal.status = "accepted";
        await proposal.save();

        // Update job status to in_progress
        await Job.findByIdAndUpdate(job._id, { status: "in_progress" });

        // Create active Contract
        const contract = await Contract.create({
            jobId: job._id,
            clientId: job.clientId,
            freelancerId: proposal.freelancerId,
            proposalId: proposal._id,
            title: job.title,
            agreedAmount: proposal.bidAmount,
            budgetType: job.budgetType,
            deadline: job.deadline,
            status: "active",
            paymentStatus: "unpaid"
        });

        // Notify Freelancer
        await Notification.create({
            userId: proposal.freelancerId,
            type: "contract",
            title: "Proposal Accepted!",
            message: `Your proposal for "${job.title}" was accepted. A new contract has been created.`,
            relatedId: contract._id,
            relatedType: "Contract"
        });

        return res.status(200).json({ message: "Proposal accepted and contract created", contract });
    } catch (error) {
        console.error("Accept proposal error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 5. Reject Proposal (Client)
const rejectProposal = async (req, res) => {
    try {
        const { id } = req.params;

        const proposal = await Proposal.findById(id).populate("jobId");
        if (!proposal) {
            return res.status(404).json({ message: "Proposal not found" });
        }

        if (proposal.jobId.clientId.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Unauthorized to reject this proposal" });
        }

        proposal.status = "rejected";
        await proposal.save();

        return res.status(200).json({ message: "Proposal rejected", proposal });
    } catch (error) {
        console.error("Reject proposal error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 6. Withdraw Proposal (Freelancer)
const withdrawProposal = async (req, res) => {
    try {
        const { id } = req.params;

        const proposal = await Proposal.findById(id);
        if (!proposal) {
            return res.status(404).json({ message: "Proposal not found" });
        }

        if (proposal.freelancerId.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized to withdraw this proposal" });
        }

        if (proposal.status !== "pending") {
            return res.status(400).json({ message: "Only pending proposals can be withdrawn" });
        }

        proposal.status = "withdrawn";
        await proposal.save();

        return res.status(200).json({ message: "Proposal withdrawn successfully", proposal });
    } catch (error) {
        console.error("Withdraw proposal error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export {
    submitProposal,
    getJobProposals,
    getMyProposals,
    acceptProposal,
    rejectProposal,
    withdrawProposal
};
