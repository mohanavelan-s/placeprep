const billingService = require('../services/billing.service');

async function getStatus(req, res) {
  res.json({
    success: true,
    data: billingService.getStatus(),
  });
}

async function getAccount(req, res) {
  const account = await billingService.getAccount(req.user);
  res.json({
    success: true,
    data: account,
  });
}

async function createCheckoutSession(req, res) {
  const session = await billingService.createCheckoutSession(req.user, req.body);
  res.status(201).json({
    success: true,
    data: session,
  });
}

async function verifyCheckoutPayment(req, res) {
  const result = await billingService.verifyCheckoutPayment(req.user, req.body);
  res.json({
    success: true,
    data: result,
  });
}

async function createPortalSession(req, res) {
  const session = await billingService.createPortalSession(req.user);
  res.status(201).json({
    success: true,
    data: session,
  });
}

async function handleWebhook(req, res) {
  const result = await billingService.handleWebhook(
    req.body,
    req.headers['x-razorpay-signature'],
  );

  res.json({
    success: true,
    data: result,
  });
}

module.exports = {
  getStatus,
  getAccount,
  createCheckoutSession,
  verifyCheckoutPayment,
  createPortalSession,
  handleWebhook,
};
