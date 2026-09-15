import Job from "../models/job.js";
import User from "../models/user.js";
import Proposal from "../models/proposal.js";

// 1. Post a new Job (Client only)
const createJob = async (req, res) => {
    try {
        const { 
            title, 
            description, 
            category, 
            skills, 
            budget, 
            budgetType, 
            jobType, 
            deadline, 
            status 
        } = req.body;

        if (!title || !description || !category || !budget || !budgetType) {
            return res.status(400).json({ message: "Title, description, category, budget, and budgetType are required" });
        }

        let formattedSkills = [];
        if (Array.isArray(skills)) {
            formattedSkills = skills;
        } else if (typeof skills === "string" && skills.trim()) {
            formattedSkills = skills.split(",").map(s => s.trim()).filter(Boolean);
        }

        const job = await Job.create({
            clientId: req.user.id,
            title: title.trim(),
            description: description.trim(),
            category: category.toLowerCase().trim(),
            skills: formattedSkills,
            budget: Number(budget),
            budgetType,
            jobType: jobType || "remote",
            deadline: deadline ? new Date(deadline) : null,
            attachments: req.files ? req.files.map(f => f.path) : (req.body.attachments || []),
            status: status || "open"
        });

        // Increment user's jobsPosted count
        await User.findByIdAndUpdate(req.user.id, { $inc: { completedJobs: 0 } });

        return res.status(201).json({ message: "Job posted successfully", job });
    } catch (error) {
        console.error("Create job error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 2. Browse / Search Jobs (Public / Freelancers)
const getJobs = async (req, res) => {
    try {
        const { 
            search, 
            category, 
            budgetType, 
            minBudget, 
            maxBudget, 
            jobType, 
            status,
            page = 1, 
            limit = 20 
        } = req.query;

        const query = { status: status || "open" };

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { skills: { $in: [new RegExp(search, "i")] } }
            ];
        }

        if (category && category !== "all") {
            query.category = { $regex: new RegExp(`^${category}$`, "i") };
        }

        if (budgetType) {
            query.budgetType = budgetType;
        }

        if (jobType) {
            query.jobType = jobType;
        }

        if (minBudget || maxBudget) {
            query.budget = {};
            if (minBudget) query.budget.$gte = Number(minBudget);
            if (maxBudget) query.budget.$lte = Number(maxBudget);
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [jobs, total] = await Promise.all([
            Job.find(query)
                .populate("clientId", "firstname lastname location companyName rating totalReviews profileImage")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Job.countDocuments(query)
        ]);

        return res.status(200).json({
            jobs,
            pagination: {
                total,
                page: Number(page),
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        console.error("Get jobs error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const getPublicMarketplaceOverview = async (req, res) => {
    try {
        const [freelancerCount, clientCount, projectsPosted, completed, categories, freelancers] = await Promise.all([
            User.countDocuments({ role: "freelancer", status: "active" }),
            User.countDocuments({ role: "client", status: "active" }),
            Job.countDocuments(),
            User.aggregate([{ $group: { _id: null, total: { $sum: "$completedJobs" } } }]),
            Job.aggregate([{ $match: { status: "open" } }, { $group: { _id: "$category", jobs: { $sum: 1 } } }, { $sort: { jobs: -1, _id: 1 } }, { $limit: 9 }]),
            User.find({ role: "freelancer", status: "active" }).select("firstname lastname profileImage location professionalTitle skills hourlyRate rating totalReviews completedJobs isVerified").sort({ rating: -1, totalReviews: -1, completedJobs: -1 }).limit(4)
        ]);
        return res.status(200).json({ stats: { freelancers: freelancerCount, clients: clientCount, projectsPosted, jobsCompleted: completed[0]?.total || 0 }, categories: categories.map((item) => ({ name: item._id || "Other Services", jobs: item.jobs })), freelancers });
    } catch (error) {
        console.error("Get public marketplace overview error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 3. Get Single Job Details
const getJobById = async (req, res) => {
    try {
        const { id } = req.params;

        const job = await Job.findById(id).populate("clientId", "firstname lastname location companyName rating totalReviews profileImage createdAt");

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        const jobData = job.toObject();
        if (req.user.role === "freelancer") {
            const application = await Proposal.findOne({ jobId: job._id, freelancerId: req.user.id }).select("_id status");
            jobData.application = application ? { applied: true, id: application._id, status: application.status } : { applied: false };
        }

        return res.status(200).json(jobData);
    } catch (error) {
        console.error("Get job by ID error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 4. Get Client's own posted jobs
const getMyClientJobs = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = { clientId: req.user.id };
        if (status) filter.status = status;

        const jobs = await Job.find(filter).sort({ createdAt: -1 });

        return res.status(200).json(jobs);
    } catch (error) {
        console.error("Get my client jobs error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 5. Update Job
const updateJob = async (req, res) => {
    try {
        const { id } = req.params;
        const job = await Job.findById(id);

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        // Only job owner or admin can update
        if (job.clientId.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "You are not authorized to update this job" });
        }

        const allowedFields = new Set([
            "title", "description", "category", "skills", "budget",
            "budgetType", "jobType", "deadline", "attachments", "status"
        ]);
        const updates = Object.fromEntries(
            Object.entries(req.body).filter(([key]) => allowedFields.has(key))
        );

        // A client may manage a draft, open listing, or close a listing, but
        // contract lifecycle states are controlled by the platform.
        if (updates.status && !["draft", "open", "closed"].includes(updates.status)) {
            delete updates.status;
        }

        const updatedJob = await Job.findByIdAndUpdate(id, updates, {
            new: true,
            runValidators: true
        });
        return res.status(200).json({ message: "Job updated successfully", job: updatedJob });
    } catch (error) {
        console.error("Update job error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 6. Delete Job
const deleteJob = async (req, res) => {
    try {
        const { id } = req.params;
        const job = await Job.findById(id);

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (job.clientId.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "You are not authorized to delete this job" });
        }

        await Job.findByIdAndDelete(id);
        return res.status(200).json({ message: "Job deleted successfully" });
    } catch (error) {
        console.error("Delete job error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export {
    createJob,
    getJobs,
    getPublicMarketplaceOverview,
    getJobById,
    getMyClientJobs,
    updateJob,
    deleteJob
};
