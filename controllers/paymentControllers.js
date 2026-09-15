import crypto from "crypto";
import Payment from "../models/payment.js";
import Contract from "../models/contract.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";
import Conversation from "../models/conversation.js";
import Message from "../models/message.js";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

// ─────────────────────────────────────────────────────────────
// Helper: call Paystack API
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
const recordConfirmedPayment = async (payment, txData) => {
  payment.status = "successful";
  payment.channel = txData.channel;
  payment.gatewayResponse = txData.gateway_response;
  payment.providerTransactionId = txData.id?.toString();
  payment.verifiedAt = new Date();
  payment.paidAt = txData.paid_at ? new Date(txData.paid_at) : new Date();
  payment.paymentMethod = txData.channel;
  await payment.save();
  await Contract.findByIdAndUpdate(payment.contractId, { paymentStatus: "payment_sent" });
  const message = `Payment Sent: ₦${payment.amount.toLocaleString()} has been paid by the client via Paystack. Reference: ${payment.transactionReference}. Please confirm receipt.`;
  let conversation = await Conversation.findOne({ participants: { $all: [payment.clientId, payment.freelancerId], $size: 2 } });
  if (!conversation) conversation = await Conversation.create({ participants: [payment.clientId, payment.freelancerId], contractId: payment.contractId, jobId: payment.jobId });
  await Message.create({ conversationId: conversation._id, senderId: payment.clientId, receiverId: payment.freelancerId, message, read: false });
  await Conversation.findByIdAndUpdate(conversation._id, { $set: { lastMessage: message, lastMessageAt: new Date() }, $pull: { deletedFor: { $in: [payment.clientId, payment.freelancerId] } } });
  await Notification.create({ userId: payment.freelancerId, type: "payment", title: "Payment Sent by Client", message, relatedId: payment.contractId, relatedType: "Contract" });
};

// 1. Initialize Payment for an approved contract
//    POST /api/payments/initialize
//    Body: { contractId }
// ─────────────────────────────────────────────────────────────
export const initializePaystackPayment = async (req, res) => {
  try {
    const { contractId } = req.body;

    if (!contractId) {
      return res.status(400).json({ message: "contractId is required" });
    }

    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }
    if (contract.clientId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the client can pay for this contract" });
    }
    if (contract.paymentStatus !== "unpaid") {
      return res.status(409).json({ message: "This contract has already been paid" });
    }

    const client = await User.findById(req.user.id).select("email firstname lastname");
    if (!client) {
      return res.status(404).json({ message: "Client account not found" });
    }

    const amountInKobo = Math.round(contract.agreedAmount * 100);

    // Create a pending payment record first
    const payment = await Payment.create({
      contractId: contract._id,
      jobId: contract.jobId,
      clientId: contract.clientId,
      freelancerId: contract.freelancerId,
      amount: contract.agreedAmount,
      currency: "NGN",
      provider: "paystack",
      status: "pending"
    });

    // Initialize with Paystack
    const paystackRes = await paystackRequest("POST", "/transaction/initialize", {
      email: client.email,
      amount: amountInKobo,
      reference: payment._id.toString(),
      // Paystack redirects the client here and appends its payment reference.
      // CLIENT_URL is the deployed frontend origin configured for emails/CORS.
      callback_url: `${(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "")}/client/payments`,
      metadata: {
        contractId: contract._id.toString(),
        clientId: client._id.toString(),
        clientName: `${client.firstname} ${client.lastname}`,
        custom_fields: [
          { display_name: "Contract", variable_name: "contract_title", value: contract.title }
        ]
      }
    });

    if (!paystackRes.status) {
      // Remove the pending payment if Paystack init failed
      await Payment.findByIdAndDelete(payment._id);
      return res.status(502).json({ message: paystackRes.message || "Failed to initialize payment with Paystack" });
    }

    // Save Paystack details to payment record
    payment.transactionReference = paystackRes.data.reference;
    payment.authorizationUrl = paystackRes.data.authorization_url;
    payment.accessCode = paystackRes.data.access_code;
    await payment.save();

    return res.status(200).json({
      message: "Payment initialized successfully",
      data: {
        paymentId: payment._id,
        authorizationUrl: paystackRes.data.authorization_url,
        accessCode: paystackRes.data.access_code,
        reference: paystackRes.data.reference,
        amount: contract.agreedAmount,
        currency: "NGN"
      }
    });
  } catch (error) {
    console.error("Initialize payment error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// 2. Verify Payment (Frontend calls after redirect from Paystack)
//    GET /api/payments/verify/:reference
// ─────────────────────────────────────────────────────────────
export const verifyPaystackPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ message: "Payment reference is required" });
    }

    // Find the payment record
    const payment = await Payment.findOne({ transactionReference: reference });
    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    // Don't re-verify already successful payments
    if (payment.status === "successful") {
      return res.status(200).json({ message: "Payment already verified", data: payment });
    }

    // Verify with Paystack
    const paystackRes = await paystackRequest("GET", `/transaction/verify/${reference}`);

    if (!paystackRes.status) {
      return res.status(502).json({ message: paystackRes.message || "Failed to verify payment" });
    }

    const txData = paystackRes.data;

    if (txData.status === "success") {
      // Update payment record
      payment.status = "successful";
      payment.channel = txData.channel;
      payment.gatewayResponse = txData.gateway_response;
      payment.providerTransactionId = txData.id?.toString();
      payment.verifiedAt = new Date();
      payment.paidAt = txData.paid_at ? new Date(txData.paid_at) : new Date();
      payment.paymentMethod = txData.channel;
      await payment.save();

      await recordConfirmedPayment(payment, txData);

      return res.status(200).json({ message: "Payment verified successfully", data: payment });
    } else {
      // Payment failed or abandoned
      payment.status = "failed";
      payment.gatewayResponse = txData.gateway_response || txData.status;
      await payment.save();

      return res.status(400).json({ message: "Payment was not successful", data: payment });
    }
  } catch (error) {
    console.error("Verify payment error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// 4. Get Payment History (Freelancer: received; Client: sent)
//    GET /api/payments/history
// ─────────────────────────────────────────────────────────────
export const getPaymentHistory = async (req, res) => {
  try {
    const filter =
      req.user.role === "freelancer"
        ? { freelancerId: req.user.id }
        : { clientId: req.user.id };

    const payments = await Payment.find(filter)
      .populate("contractId", "title status")
      .populate("jobId", "title category")
      .sort({ createdAt: -1 });

    return res.status(200).json({ data: payments });
  } catch (error) {
    console.error("Payment history error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// 5. Get Freelancer Earnings Stats
//    GET /api/payments/earnings-stats
// ─────────────────────────────────────────────────────────────
export const getEarningsStats = async (req, res) => {
  try {
    const freelancerId = req.user.id;

    const paidResult = await Payment.aggregate([
      { $match: { freelancerId: new (await import("mongoose")).default.Types.ObjectId(freelancerId), status: { $in: ["successful", "released"] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalEarned = paidResult[0]?.total || 0;

    return res.status(200).json({
      data: {
        totalEarned,
        availableForPayout: totalEarned
      }
    });
  } catch (error) {
    console.error("Earnings stats error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// 6. Paystack Webhook
//    POST /api/payments/webhook
// ─────────────────────────────────────────────────────────────
export const handlePaystackWebhook = async (req, res) => {
  try {
    // Validate the webhook signature
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(req.rawBody || JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(401).send("Invalid signature");
    }

    const { event, data } = req.body;

    if (event === "charge.success") {
      const reference = data.reference;
      const payment = await Payment.findOne({ transactionReference: reference });

      if (payment && payment.status === "pending") {
        payment.status = "successful";
        payment.channel = data.channel;
        payment.gatewayResponse = data.gateway_response;
        payment.providerTransactionId = data.id?.toString();
        payment.verifiedAt = new Date();
        payment.paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
        payment.paymentMethod = data.channel;
        await payment.save();

        await recordConfirmedPayment(payment, data);
      }
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).send("Webhook processing error");
  }
};
