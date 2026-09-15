import Payment from "../models/payment.js";
import crypto from "crypto";
import Payout from "../models/payout.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

// ─────────────────────────────────────────────────────────────
// Internal helper: call Paystack API
// ─────────────────────────────────────────────────────────────
const paystackRequest = async (method, path, body = null) => {
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json"
    }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, options);
  return res.json();
};

// ─────────────────────────────────────────────────────────────
// Internal helper: compute a freelancer's available balance
// Available = confirmed payments - payout requests already in progress or completed.
// ─────────────────────────────────────────────────────────────
const getFreelancerBalance = async (freelancerId) => {
  const mongoose = (await import("mongoose")).default;
  const fid = new mongoose.Types.ObjectId(freelancerId);

  const [earnedResult, withdrawnResult] = await Promise.all([
    Payment.aggregate([
      { $match: { freelancerId: fid, status: "successful" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Payout.aggregate([
      { $match: { freelancerId: fid, status: { $in: ["pending", "processing", "success"] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ])
  ]);

  const totalReleased = earnedResult[0]?.total || 0;
  const totalWithdrawn = withdrawnResult[0]?.total || 0;
  const available = totalReleased - totalWithdrawn;

  return { totalReleased, totalWithdrawn, available };
};

// ─────────────────────────────────────────────────────────────
// 1. List Nigerian Banks from Paystack
//    GET /api/payouts/banks
// ─────────────────────────────────────────────────────────────
export const listBanks = async (req, res) => {
  try {
    const data = await paystackRequest("GET", "/bank?currency=NGN&perPage=100");

    if (!data.status) {
      return res.status(502).json({ message: data.message || "Failed to fetch banks" });
    }

    return res.status(200).json({ data: data.data });
  } catch (error) {
    console.error("List banks error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// 2. Verify & Save Payout Account (Freelancer sets withdrawal account)
//    PUT /api/payouts/account
//    Body: { bankCode, accountNumber }
// ─────────────────────────────────────────────────────────────
export const savePayoutAccount = async (req, res) => {
  try {
    const { bankCode, accountNumber } = req.body;

    if (!bankCode || !accountNumber) {
      return res.status(400).json({ message: "bankCode and accountNumber are required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify account number with Paystack
    const resolveRes = await paystackRequest(
      "GET",
      `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`
    );

    if (!resolveRes.status) {
      return res.status(400).json({
        message: resolveRes.message || "Could not verify account. Check details and try again."
      });
    }

    const { account_name, account_number } = resolveRes.data;

    // Create a Paystack Transfer Recipient so we can send money later
    const recipientRes = await paystackRequest("POST", "/transferrecipient", {
      type: "nuban",
      name: account_name,
      account_number,
      bank_code: bankCode,
      currency: "NGN"
    });

    if (!recipientRes.status) {
      return res.status(502).json({ message: "Failed to register payout recipient with Paystack" });
    }

    // Fetch bank name from the recipient response
    const bankName = recipientRes.data?.details?.bank_name || "";

    user.payoutAccount = {
      accountName: account_name,
      accountNumber: account_number,
      bankCode,
      bankName,
      recipientCode: recipientRes.data.recipient_code,
      verifiedAt: new Date()
    };

    await user.save();

    return res.status(200).json({
      message: "Payout account saved successfully",
      data: {
        accountName: user.payoutAccount.accountName,
        accountNumberLast4: user.payoutAccount.accountNumber.slice(-4),
        bankName: user.payoutAccount.bankName,
        verifiedAt: user.payoutAccount.verifiedAt
      }
    });
  } catch (error) {
    console.error("Save payout account error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// 3. Get Payout Account (Freelancer views saved account)
//    GET /api/payouts/account
// ─────────────────────────────────────────────────────────────
export const getPayoutAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("payoutAccount");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const account = user.payoutAccount;
    return res.status(200).json({ data: account?.recipientCode ? {
      accountName: account.accountName,
      accountNumberLast4: account.accountNumber?.slice(-4),
      bankName: account.bankName,
      verifiedAt: account.verifiedAt
    } : null });
  } catch (error) {
    console.error("Get payout account error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// 4. Request a Payout (Freelancer withdraws available balance)
//    POST /api/payouts/request
//    Body: { amount }
// ─────────────────────────────────────────────────────────────
export const requestPayout = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ message: "A valid amount greater than 0 is required" });
    }

    const withdrawAmount = Number(amount);

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.payoutAccount?.accountNumber || !user.payoutAccount?.recipientCode) {
      return res.status(400).json({
        message: "Please set up a verified payout account before requesting a withdrawal"
      });
    }

    // Check available balance
    const { available } = await getFreelancerBalance(req.user.id);
    if (withdrawAmount > available) {
      return res.status(400).json({
        message: `Insufficient balance. Your available balance is ₦${available.toLocaleString()}`
      });
    }

    // Create payout record
    const payout = await Payout.create({
      freelancerId: req.user.id,
      amount: withdrawAmount,
      currency: "NGN",
      accountName: user.payoutAccount.accountName,
      accountNumber: user.payoutAccount.accountNumber,
      bankCode: user.payoutAccount.bankCode,
      bankName: user.payoutAccount.bankName,
      recipientCode: user.payoutAccount.recipientCode,
      status: "pending"
    });

    // Initiate transfer via Paystack
    const transferRes = await paystackRequest("POST", "/transfer", {
      source: "balance",
      amount: Math.round(withdrawAmount * 100), // kobo
      recipient: user.payoutAccount.recipientCode,
      reason: `FreelanceX payout - ${user.firstname} ${user.lastname}`,
      reference: payout._id.toString()
    });

    if (!transferRes.status) {
      // Mark payout as failed if Paystack rejected it
      payout.status = "failed";
      payout.failureReason = transferRes.message || "Transfer initiation failed";
      await payout.save();

      return res.status(502).json({
        message: transferRes.message || "Failed to initiate transfer. Please try again."
      });
    }

    // Update payout with Paystack transfer details
    payout.status = "processing";
    payout.transferCode = transferRes.data?.transfer_code;
    payout.paystackTransferId = transferRes.data?.id?.toString();
    payout.processedAt = new Date();
    await payout.save();

    return res.status(200).json({
      message: "Payout request submitted. Transfer is being processed.",
      data: {
        payoutId: payout._id,
        amount: withdrawAmount,
        bankName: payout.bankName,
        accountNumber: payout.accountNumber,
        status: payout.status
      }
    });
  } catch (error) {
    console.error("Request payout error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// 5. Get Payout History (Freelancer)
//    GET /api/payouts/history
// ─────────────────────────────────────────────────────────────
export const getPayoutHistory = async (req, res) => {
  try {
    const payouts = await Payout.find({ freelancerId: req.user.id }).sort({ createdAt: -1 });

    return res.status(200).json({ data: payouts });
  } catch (error) {
    console.error("Payout history error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// 6. Get Freelancer Balance Summary
//    GET /api/payouts/balance
// ─────────────────────────────────────────────────────────────
export const getBalance = async (req, res) => {
  try {
    const balance = await getFreelancerBalance(req.user.id);

    return res.status(200).json({ data: balance });
  } catch (error) {
    console.error("Get balance error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// 7. Paystack Transfer Webhook (transfer.success / transfer.failed / transfer.reversed)
//    POST /api/payouts/webhook
// ─────────────────────────────────────────────────────────────
export const handleTransferWebhook = async (req, res) => {
  try {
    if (!PAYSTACK_SECRET_KEY || !req.rawBody) return res.status(400).send("Missing webhook payload");
    const signature = req.headers["x-paystack-signature"];
    const expected = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(req.rawBody).digest("hex");
    if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return res.status(401).send("Invalid signature");
    }
    const { event, data } = req.body;

    if (["transfer.success", "transfer.failed", "transfer.reversed"].includes(event)) {
      const reference = data.reference;
      const payout = await Payout.findById(reference);

      if (!payout) {
        return res.status(200).send("OK"); // Not our record, ignore gracefully
      }

      if (event === "transfer.success") {
        payout.status = "success";
        payout.paystackTransferId = data.id?.toString();
        await payout.save();

        await Notification.create({
          userId: payout.freelancerId,
          type: "payment",
          title: "Payout Successful 🎉",
          message: `₦${payout.amount.toLocaleString()} has been sent to your ${payout.bankName} account ending in ${payout.accountNumber.slice(-4)}.`,
          relatedId: payout._id,
          relatedType: "Payout"
        });
      } else if (event === "transfer.failed" || event === "transfer.reversed") {
        payout.status = event === "transfer.failed" ? "failed" : "reversed";
        payout.failureReason = data.reason || "Transfer was not completed";
        await payout.save();

        await Notification.create({
          userId: payout.freelancerId,
          type: "payment",
          title: event === "transfer.failed" ? "Payout Failed" : "Payout Reversed",
          message: `Your payout of ₦${payout.amount.toLocaleString()} could not be completed. Reason: ${payout.failureReason}. Please contact support.`,
          relatedId: payout._id,
          relatedType: "Payout"
        });
      }
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Transfer webhook error:", error);
    return res.status(500).send("Webhook processing error");
  }
};
