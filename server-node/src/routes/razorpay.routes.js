const express = require('express');
const { body } = require('express-validator');

const billingController = require('../controllers/billing.controller');
const { requireAuth, requireNonObserver } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post(
  '/create-order',
  requireAuth,
  requireNonObserver('Observer access cannot start billing checkout.'),
  [
    body('tier').optional().isIn(['pro', 'college']),
    body('billingCycle').optional().isIn(['monthly', 'annual']),
    body('planKey').optional().isIn(['pro_monthly', 'pro_annual', 'college']),
  ],
  validate,
  asyncHandler(billingController.createCheckoutSession)
);

router.post(
  '/verify-payment',
  requireAuth,
  requireNonObserver('Observer access cannot verify billing checkout.'),
  [
    body('razorpay_order_id').optional().isString().trim(),
    body('razorpay_payment_id').optional().isString().trim(),
    body('razorpay_signature').optional().isString().trim(),
    body('orderId').optional().isString().trim(),
    body('paymentId').optional().isString().trim(),
    body('signature').optional().isString().trim(),
  ],
  validate,
  asyncHandler(billingController.verifyCheckoutPayment)
);

module.exports = router;
