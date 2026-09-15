import { config } from "dotenv";
config();
import User from "../models/user.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    },
});

// 1. SIGNUP CONTROLLER
const createUser = async (req, res) => {
    try {
        let { 
            firstname, 
            lastname, 
            email, 
            password, 
            role, 
            phone,
            location,
            bio,
            companyName, 
            website, 
            professionalTitle, 
            skills, 
            hourlyRate, 
            experience 
        } = req.body;

        let imageurl = req?.file?.path || null;

        if (!firstname || !lastname || !email || !password) {
            return res.status(400).json({ message: "All required fields must be filled" });
        }

        let existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return res.status(400).json({ message: "An account with this email already exists" });
        }

        let hashedPassword = await bcrypt.hash(password, 10);

        let formattedSkills = [];
        if (Array.isArray(skills)) {
            formattedSkills = skills;
        } else if (typeof skills === "string" && skills.trim()) {
            formattedSkills = skills.split(",").map(s => s.trim()).filter(Boolean);
        }

        let user = await User.create({ 
            firstname: firstname.trim(), 
            lastname: lastname.trim(), 
            email: email.toLowerCase().trim(), 
            password: hashedPassword,
            role: role || "client",
            profileImage: imageurl,
            phone: phone || null,
            location: location || null,
            bio: bio || null,
            companyName: companyName || null,
            website: website || null,
            professionalTitle: professionalTitle || (role === "freelancer" ? "Freelancer" : null),
            skills: formattedSkills,
            hourlyRate: hourlyRate ? Number(hourlyRate) : null,
            experience: experience || "entry"
        });

        // Send Professional Welcome Email
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const isFreelancer = user.role === "freelancer";
        const dashboardUrl = isFreelancer ? `${clientUrl}/freelancer` : `${clientUrl}/client`;
        const ctaLabel = isFreelancer ? "Explore Open Jobs" : "Post Your First Job";
        const ctaUrl = isFreelancer ? `${clientUrl}/freelancer/jobs` : `${clientUrl}/client/post-job`;

        const mailOptions = {
            from: `"FreelanceX" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Welcome to FreelanceX, ${firstname}! 🚀`,
            html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Welcome to FreelanceX</title>
              <style>
                body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #334155; }
                .wrapper { width: 100%; table-layout: fixed; background-color: #F8FAFC; padding: 40px 0; }
                .main { background-color: #ffffff; margin: 0 auto; max-width: 600px; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
                .header-bar { height: 5px; background: linear-gradient(90deg, #2563EB 0%, #3B82F6 100%); }
                .content { padding: 40px 36px; }
                .logo { font-size: 24px; font-weight: 800; color: #0F172A; text-decoration: none; letter-spacing: -0.5px; }
                .logo-accent { color: #2563EB; }
                .badge { display: inline-block; background-color: #EFF6FF; color: #1D4ED8; font-size: 12px; font-weight: 700; padding: 5px 14px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px; }
                .headline { font-size: 26px; font-weight: 700; color: #0F172A; margin: 16px 0 12px 0; line-height: 1.3; }
                .subline { font-size: 16px; color: #64748B; line-height: 1.6; margin-bottom: 28px; }
                .card { background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 24px; margin-bottom: 28px; }
                .card-title { font-size: 15px; font-weight: 700; color: #0F172A; margin-top: 0; margin-bottom: 14px; }
                .step-item { display: flex; align-items: flex-start; margin-bottom: 12px; font-size: 14px; color: #475569; line-height: 1.5; }
                .step-item:last-child { margin-bottom: 0; }
                .btn { display: inline-block; background-color: #2563EB; color: #ffffff !important; font-weight: 600; font-size: 15px; text-align: center; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25); }
                .footer { padding: 28px 36px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center; font-size: 13px; color: #94A3B8; }
                .footer a { color: #2563EB; text-decoration: none; }
              </style>
            </head>
            <body>
              <center class="wrapper">
                <table class="main" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td class="header-bar"></td>
                  </tr>
                  <tr>
                    <td class="content">
                      <div class="logo">
                        Freelance<span class="logo-accent">X</span>
                      </div>
                      
                      <div class="badge">
                        ${isFreelancer ? "Freelancer Account" : "Client Account"}
                      </div>
                      
                      <h1 class="headline">Welcome to FreelanceX, ${firstname}! 🎉</h1>
                      
                      <p class="subline">
                        ${isFreelancer 
                          ? "We're thrilled to have you in our talent community! You're now ready to connect with premier clients, submit proposals, and grow your freelance career." 
                          : "We're excited to partner with you! FreelanceX makes it effortless to post projects, connect with vetted professionals, and manage milestones safely."}
                      </p>

                      <div class="card">
                        <div class="card-title">
                          ${isFreelancer ? "Next steps to win your first project:" : "Quick steps to hire top talent:"}
                        </div>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          ${isFreelancer ? `
                          <tr>
                            <td style="padding: 6px 0; font-size: 14px; color: #334155;">
                              🎯 <strong>Complete your profile:</strong> Highlight your skills, hourly rate, and portfolio.
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 6px 0; font-size: 14px; color: #334155;">
                              🔍 <strong>Search curated jobs:</strong> Filter opportunities by category, budget, and scope.
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 6px 0; font-size: 14px; color: #334155;">
                              🛡️ <strong>Verified payments:</strong> Work with confidence knowing payments are confirmed upon job completion.
                            </td>
                          </tr>
                          ` : `
                          <tr>
                            <td style="padding: 6px 0; font-size: 14px; color: #334155;">
                              📝 <strong>Post your job:</strong> Outline project requirements, timeline, and budget.
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 6px 0; font-size: 14px; color: #334155;">
                              ⚡ <strong>Review proposals:</strong> Compare verified freelancer bids, portfolios, and ratings.
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 6px 0; font-size: 14px; color: #334155;">
                              🔒 <strong>Secure milestone release:</strong> Only release payment when deliverables are approved.
                            </td>
                          </tr>
                          `}
                        </table>
                      </div>

                      <div style="text-align: center; margin: 32px 0;">
                        <a href="${ctaUrl}" class="btn" target="_blank">${ctaLabel}</a>
                      </div>

                      <p style="font-size: 14px; color: #64748B; margin-top: 28px; line-height: 1.5;">
                        You can also head straight to your <a href="${dashboardUrl}" style="color: #2563EB; text-decoration: none; font-weight: 600;">Dashboard</a> anytime to manage your account.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td class="footer">
                      <p style="margin: 0 0 10px 0;">
                        Need help? Visit our <a href="${clientUrl}">Help Center</a> or reply directly to this email.
                      </p>
                      <p style="margin: 0;">
                        &copy; ${new Date().getFullYear()} FreelanceX Inc. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </center>
            </body>
            </html>
            `,
        };

        await transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending welcome email:', error);
            } else {
                console.log('Welcome email sent:', info.response);
            }
        });

        return res.status(201).json({ 
            message: "Signup successful",
            user: {
                id: user._id,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                role: user.role,
                profileImage: user.profileImage,
                profileSetupCompleted: user.profileSetupCompleted
            }
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 2. LOGIN CONTROLLER
const login = async (req, res) => {
    try {
        let { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        let checkUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (!checkUser) {
            return res.status(404).json({ message: "Incorrect email" });
        }

        let checkPassword = await bcrypt.compare(password, checkUser.password);
        if (!checkPassword) {
            return res.status(401).json({ message: "Incorrect password" });
        }

        let token = jwt.sign(
            { id: checkUser._id, role: checkUser.role },
            process.env.SECRET_KEY,
            { expiresIn: "1d" }
        );
        
        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 1000 * 60 * 60 * 24, // 1 day
        });

        return res.status(200).json({ 
            message: "Login successful", 
            token,
            user: {
                id: checkUser._id,
                firstname: checkUser.firstname,
                lastname: checkUser.lastname,
                email: checkUser.email,
                role: checkUser.role,
                profileImage: checkUser.profileImage,
                profileSetupCompleted: checkUser.profileSetupCompleted
            } 
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 3. GET ALL USERS
const getAllUsers = async (req, res) => {
    try {
        let users = await User.find().select("-password");

        if (!users || users.length === 0) {
            return res.status(404).json({ message: "No users found" });
        }

        return res.status(200).json(users);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 4. GET ONE USER
const getOneUser = async (req, res) => {
    try {
        let { id } = req.params;
        if (req.user.role !== "admin" && req.user.id !== id) {
            return res.status(403).json({ message: "You can only view your own private profile" });
        }
        let user = await User.findById(id).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json(user);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const getPublicFreelancerProfile = async (req, res) => {
    try {
        const freelancer = await User.findOne({
            _id: req.params.id,
            role: "freelancer"
        }).select("firstname lastname profileImage location bio professionalTitle skills hourlyRate experience rating totalReviews completedJobs portfolio isVerified");

        if (!freelancer) {
            return res.status(404).json({ message: "Freelancer profile not found" });
        }

        return res.status(200).json({ ...freelancer.toObject(), payoutAvailable: false });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 5. DELETE USER
const deleteOneUser = async (req, res) => {
    try {
        let { id } = req.params;
        let user = await User.findByIdAndDelete(id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 6. UPDATE USER
const updateOneUser = async (req, res) => {
    try {
        let { id } = req.params;
        const existingUser = await User.findById(id).select("_id role");

        if (!existingUser) {
            return res.status(404).json({ message: "User not found" });
        }

        if (req.user.role !== "admin" && req.user.id !== existingUser._id.toString()) {
            return res.status(403).json({ message: "You can only update your own profile" });
        }

        const commonFields = ["firstname", "lastname", "phone", "location", "bio"];
        const clientFields = ["companyName", "website"];
        const freelancerFields = ["professionalTitle", "skills", "hourlyRate", "availability", "experience", "portfolio"];
        const allowedFields = new Set([
            ...commonFields,
            ...(existingUser.role === "client" ? clientFields : []),
            ...(existingUser.role === "freelancer" ? freelancerFields : [])
        ]);
        const newData = Object.fromEntries(
            Object.entries(req.body).filter(([key]) => allowedFields.has(key))
        );

        if (req.file) {
            newData.profileImage = req.file.path;
        }

        // Saving the account details is the explicit completion action for the
        // setup prompt. This applies to freelancer, client, and admin accounts.
        newData.profileSetupCompleted = true;

        let user = await User.findByIdAndUpdate(id, newData, { new: true, runValidators: true }).select("-password");

        return res.status(200).json({ message: "User updated successfully", user });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 7. FORGOT PASSWORD
const forgotpassword = async (req, res) => {
    try {
        let { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        let user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        let token = jwt.sign(
            { id: user._id },
            process.env.SECRET_KEY,
            { expiresIn: "1h" }
        );

        const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${token}`;

        let mailOptions = {
            from: `"FreelanceX Security" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Reset your FreelanceX password",
            html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Reset Your Password</title>
              <style>
                body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #334155; }
                .wrapper { width: 100%; table-layout: fixed; background-color: #F8FAFC; padding: 40px 0; }
                .main { background-color: #ffffff; margin: 0 auto; max-width: 600px; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
                .header-bar { height: 5px; background: linear-gradient(90deg, #2563EB 0%, #3B82F6 100%); }
                .content { padding: 40px 36px; }
                .logo { font-size: 24px; font-weight: 800; color: #0F172A; text-decoration: none; letter-spacing: -0.5px; }
                .logo-accent { color: #2563EB; }
                .headline { font-size: 24px; font-weight: 700; color: #0F172A; margin: 24px 0 12px 0; }
                .subline { font-size: 15px; color: #64748B; line-height: 1.6; margin-bottom: 24px; }
                .btn { display: inline-block; background-color: #2563EB; color: #ffffff !important; font-weight: 600; font-size: 15px; text-align: center; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25); }
                .note { background-color: #FEF3C7; border: 1px solid #FDE68A; border-radius: 10px; padding: 14px 18px; font-size: 13px; color: #92400E; margin-top: 28px; line-height: 1.5; }
                .footer { padding: 24px 36px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center; font-size: 13px; color: #94A3B8; }
              </style>
            </head>
            <body>
              <center class="wrapper">
                <table class="main" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td class="header-bar"></td>
                  </tr>
                  <tr>
                    <td class="content">
                      <div class="logo">
                        Freelance<span class="logo-accent">X</span>
                      </div>
                      
                      <h1 class="headline">Password Reset Request</h1>
                      
                      <p class="subline">
                        Hello ${user.firstname},<br><br>
                        We received a request to reset the password associated with your FreelanceX account. Click the button below to choose a new password. This link is valid for <strong>1 hour</strong>.
                      </p>

                      <div style="text-align: center; margin: 32px 0;">
                        <a href="${resetUrl}" class="btn" target="_blank">Reset Password</a>
                      </div>

                      <div class="note">
                        🔒 <strong>Security reminder:</strong> If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td class="footer">
                      &copy; ${new Date().getFullYear()} FreelanceX Inc. All rights reserved.
                    </td>
                  </tr>
                </table>
              </center>
            </body>
            </html>
            `,
        };

        await transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log('Error sending email:', error);
            } else {
                console.log('Email sent:', info.response);
            }
        });

        return res.status(200).json({ message: "Password reset email sent" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 8. RESET PASSWORD
const resetpassword = async (req, res) => {
    try {
        let { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ message: "Token and new password are required" });
        }

        let decoded = jwt.verify(token, process.env.SECRET_KEY);
        let hashedPassword = await bcrypt.hash(newPassword, 10);

        let user = await User.findByIdAndUpdate(decoded.id, { password: hashedPassword }, { new: true });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({ message: "Password reset successful" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 9. CHECK AUTH USER
const checkuser = async (req, res) => {
    try {
        let user = await User.findById(req.user.id).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json(user);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export { 
    createUser, 
    getAllUsers, 
    getOneUser, 
    getPublicFreelancerProfile,
    deleteOneUser, 
    updateOneUser, 
    checkuser, 
    login, 
    forgotpassword, 
    resetpassword 
};
