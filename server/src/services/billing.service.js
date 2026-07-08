const crypto = require('crypto');
const Razorpay = require('razorpay');

const env = require('../config/env');
const { withTransaction } = require('../config/database');
const billingRepository = require('../repositories/billing.repository');
const userRepository = require('../repositories/user.repository');
const { sendBillingReceiptEmail } = require('./email.service');
const AppError = require('../utils/appError');

let razorpayClient = null;

const TIER_RANK = {
  free: 0,
  pro: 1,
  college: 2,
};

const BILLING_PLANS = {
  pro_monthly: {
    planKey: 'pro_monthly',
    tier: 'pro',
    billingCycle: 'monthly',
    label: 'PlacePrep Pro Monthly',
    amount: () => env.razorpayProMonthlyAmount,
    durationMonths: 1,
  },
  pro_annual: {
    planKey: 'pro_annual',
    tier: 'pro',
    billingCycle: 'annual',
    label: 'PlacePrep Pro Annual',
    amount: () => env.razorpayProAnnualAmount,
    durationMonths: 12,
  },
  college: {
    planKey: 'college',
    tier: 'college',
    billingCycle: 'annual',
    label: 'PlacePrep College',
    amount: () => env.razorpayCollegeAmount,
    durationMonths: 12,
    quoteBased: true,
  },
};

const ACCESS_STATUSES = new Set(['active', 'paid', 'captured']);
const HOLD_STATUSES = new Set(['created', 'attempted', 'authorized']);
const TERMINAL_STATUSES = new Set(['cancelled', 'canceled', 'failed', 'expired', 'refunded']);

function normalizeTier(value, fallback = 'free') {
  const tier = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TIER_RANK, tier) ? tier : fallback;
}

function higherTier(left, right) {
  return TIER_RANK[normalizeTier(right)] > TIER_RANK[normalizeTier(left)] ? normalizeTier(right) : normalizeTier(left);
}

function getPlanAmount(plan) {
  const amount = Number(plan.amount());
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
}

function normalizeBillingCycle(value, fallback = 'monthly') {
  const cycle = String(value || '').trim().toLowerCase();
  return ['monthly', 'annual'].includes(cycle) ? cycle : fallback;
}

function resolvePlanKey(tier, billingCycle, planKey) {
  const requestedPlanKey = String(planKey || '').trim().toLowerCase();
  if (requestedPlanKey && BILLING_PLANS[requestedPlanKey]) {
    return requestedPlanKey;
  }

  const normalizedTier = normalizeTier(tier, 'pro');
  if (normalizedTier === 'college') {
    return 'college';
  }

  return normalizeBillingCycle(billingCycle) === 'annual' ? 'pro_annual' : 'pro_monthly';
}

function resolvePlan(payload = {}) {
  const planKey = resolvePlanKey(payload.tier, payload.billingCycle, payload.planKey);
  const plan = BILLING_PLANS[planKey];

  if (!plan) {
    throw new AppError('Unsupported billing plan.', 400, {
      code: 'unsupported_billing_plan',
      supportedPlans: Object.values(BILLING_PLANS).map((item) => item.planKey),
    });
  }

  const amount = getPlanAmount(plan);
  if (!amount || amount < 100) {
    throw new AppError(`${plan.label} is not configured for Razorpay checkout yet.`, 503, {
      code: 'razorpay_amount_not_configured',
      tier: plan.tier,
      minimumAmount: 100,
    });
  }

  return {
    ...plan,
    amount,
  };
}

function addMonths(value, months) {
  const start = value instanceof Date ? new Date(value) : new Date(value || Date.now());
  const end = new Date(start);
  end.setMonth(end.getMonth() + Number(months || 0));
  return end;
}

function isExpiredAccess(subscription) {
  if (!subscription?.currentPeriodEnd) {
    return false;
  }

  const periodEnd = new Date(subscription.currentPeriodEnd);
  return !Number.isNaN(periodEnd.getTime()) && periodEnd.getTime() <= Date.now();
}

function isCurrentAccess(subscription) {
  return ACCESS_STATUSES.has(subscription.status) && !isExpiredAccess(subscription);
}

function requireRazorpayConfigured() {
  if (!env.razorpayEnabled) {
    throw new AppError('Razorpay is not configured yet.', 503, {
      code: 'razorpay_not_configured',
    });
  }
}

function getRazorpayClient() {
  requireRazorpayConfigured();

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: env.razorpayKeyId,
      key_secret: env.razorpayKeySecret,
    });
  }

  return razorpayClient;
}

function isMissingBillingStorageError(error) {
  return error?.code === '42P01'
    || /billing_(customers|subscriptions|events)/i.test(String(error?.message || ''));
}

function toRazorpayError(error) {
  const statusCode = Number(error?.statusCode || error?.status_code || 500);
  const code = error?.error?.code || error?.code || 'razorpay_request_failed';
  const isAuthFailure = statusCode === 401
    || (code === 'BAD_REQUEST_ERROR' && /auth|key|credential/i.test(error?.message || ''));

  return new AppError(error?.error?.description || error?.message || 'Razorpay request failed.', isAuthFailure ? 401 : statusCode, {
    code,
    reason: error?.error?.reason || error?.reason,
  });
}

function getCheckoutMode() {
  return env.razorpayCheckoutMode === 'hosted' ? 'hosted' : 'payment';
}

function getPaymentLinkCallbackUrl() {
  if (env.razorpayPaymentLinkCallbackUrl) {
    return env.razorpayPaymentLinkCallbackUrl;
  }

  return `${env.clientUrl || env.appUrl}/settings?billing=return`;
}

function getStatus() {
  const availablePlans = Object.values(BILLING_PLANS)
    .map((plan) => ({
      planKey: plan.planKey,
      tier: plan.tier,
      billingCycle: plan.billingCycle,
      label: plan.label,
      configured: Boolean(getPlanAmount(plan)),
      amount: getPlanAmount(plan),
      currency: env.razorpayCurrency,
      quoteBased: Boolean(plan.quoteBased),
    }));

  return {
    provider: 'razorpay',
    razorpayEnabled: env.razorpayEnabled,
    checkoutEnabled: env.razorpayCheckoutEnabled,
    publishableKeyConfigured: Boolean(env.razorpayKeyId),
    webhookConfigured: Boolean(env.razorpayWebhookSecret),
    checkoutMode: getCheckoutMode(),
    keyId: env.razorpayKeyId || null,
    currency: env.razorpayCurrency,
    availablePlans,
  };
}

async function getAccount(user) {
  try {
    const reconciledUser = await reconcileUserTier(user.id);
    const [customer, latestSubscription] = await Promise.all([
      billingRepository.findCustomerByUserId(user.id),
      billingRepository.findLatestSubscriptionByUserId(user.id),
    ]);
    const currentUser = reconciledUser || await userRepository.findById(user.id);

    return {
      tier: currentUser?.tier || user.tier || 'free',
      billingTier: currentUser?.coachMetadata?.billingTier || null,
      billingStatus: currentUser?.coachMetadata?.billingStatus || null,
      billingCycle: currentUser?.coachMetadata?.billingCycle || latestSubscription?.metadata?.billingCycle || null,
      razorpayCustomerId: customer?.stripeCustomerId || null,
      customer,
      subscription: latestSubscription,
      canManageBilling: false,
    };
  } catch (error) {
    if (!isMissingBillingStorageError(error)) {
      throw error;
    }

    console.warn('[billing] Billing account storage is not migrated yet; returning profile tier only.', {
      userId: user.id,
      reason: error.message,
    });
    const currentUser = await userRepository.findById(user.id);
    return {
      tier: currentUser?.tier || user.tier || 'free',
      billingTier: currentUser?.coachMetadata?.billingTier || null,
      billingStatus: currentUser?.coachMetadata?.billingStatus || null,
      billingCycle: currentUser?.coachMetadata?.billingCycle || null,
      razorpayCustomerId: null,
      customer: null,
      subscription: null,
      canManageBilling: false,
      migrationRequired: true,
    };
  }
}
function buildCheckoutReference(plan, user) {
  const compactPlanKey = plan.planKey.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase();
  return `pp_${compactPlanKey}_${Date.now().toString(36)}_${String(user.id).replace(/-/g, '').slice(0, 6)}`;
}

function normalizeRazorpayContact(value) {
  const digits = String(value || '').replace(/\D/g, '');

  if (digits.length === 10) {
    return `91${digits}`;
  }

  if (digits.length >= 8 && digits.length <= 15) {
    return digits;
  }

  return null;
}

function buildBillingNotes(user, plan, extra = {}) {
  return {
    placeprepUserId: user.id,
    placeprepUserEmail: user.email,
    targetTier: plan.tier,
    billingCycle: plan.billingCycle,
    planKey: plan.planKey,
    source: 'placeprep-billing',
    ...extra,
  };
}

async function persistPendingCheckout({ user, plan, providerId, checkoutSessionId, status, priceId, metadata }) {
  await billingRepository.upsertCustomer({
    userId: user.id,
    stripeCustomerId: `razorpay_user_${user.id}`,
    email: user.email,
    metadata: {
      provider: 'razorpay',
      source: 'checkout-created',
    },
  });

  return billingRepository.upsertSubscription({
    userId: user.id,
    stripeCustomerId: `razorpay_user_${user.id}`,
    stripeSubscriptionId: providerId,
    checkoutSessionId,
    tier: plan.tier,
    status: status || 'created',
    priceId: priceId || `${env.razorpayCurrency}_${plan.planKey}_${plan.amount}`,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    metadata: {
      provider: 'razorpay',
      planKey: plan.planKey,
      billingCycle: plan.billingCycle,
      billingDurationMonths: plan.durationMonths,
      amount: plan.amount,
      currency: env.razorpayCurrency,
      checkoutMode: getCheckoutMode(),
      ...metadata,
    },
  });
}

async function createRazorpayOrderSession(user, plan) {
  const receipt = buildCheckoutReference(plan, user);
  let order;
  try {
    order = await getRazorpayClient().orders.create({
      amount: plan.amount,
      currency: env.razorpayCurrency,
      receipt,
      notes: buildBillingNotes(user, plan),
    });
  } catch (error) {
    throw toRazorpayError(error);
  }

  await persistPendingCheckout({
    user,
    plan,
    providerId: order.id,
    checkoutSessionId: order.id,
    status: order.status || 'created',
    metadata: {
      razorpayOrderId: order.id,
      receipt,
    },
  });

  return {
    provider: 'razorpay',
    id: order.id,
    orderId: order.id,
    order_id: order.id,
    keyId: env.razorpayKeyId,
    amount: order.amount,
    currency: order.currency,
    name: 'PlacePrep',
    description: `${plan.label} access`,
    prefill: {
      name: user.name || '',
      email: user.email || '',
    },
    notes: order.notes || {},
    targetTier: plan.tier,
    billingCycle: plan.billingCycle,
    planKey: plan.planKey,
    mode: 'payment',
  };
}

async function createRazorpayPaymentLinkSession(user, plan, payload = {}) {
  const referenceId = buildCheckoutReference(plan, user);
  const contact = normalizeRazorpayContact(payload.contact);
  let paymentLink;
  try {
    paymentLink = await getRazorpayClient().paymentLink.create({
      amount: plan.amount,
      currency: env.razorpayCurrency,
      accept_partial: false,
      reference_id: referenceId,
      description: `${plan.label} access`,
      customer: {
        name: user.name || user.email || 'PlacePrep learner',
        email: user.email,
        ...(contact ? { contact } : {}),
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      callback_url: getPaymentLinkCallbackUrl(),
      callback_method: 'get',
      notes: buildBillingNotes(user, plan, {
        razorpayPaymentLinkReferenceId: referenceId,
        ...(contact ? { contact } : {}),
      }),
    });
  } catch (error) {
    throw toRazorpayError(error);
  }

  await persistPendingCheckout({
    user,
    plan,
    providerId: paymentLink.id,
    checkoutSessionId: paymentLink.id,
    status: paymentLink.status || 'created',
    metadata: {
      razorpayPaymentLinkId: paymentLink.id,
      razorpayPaymentLinkReferenceId: referenceId,
      shortUrl: paymentLink.short_url || null,
      callbackUrl: getPaymentLinkCallbackUrl(),
      contactProvided: Boolean(contact),
    },
  });

  return {
    provider: 'razorpay',
    id: paymentLink.id,
    paymentLinkId: paymentLink.id,
    keyId: env.razorpayKeyId,
    amount: paymentLink.amount || plan.amount,
    currency: paymentLink.currency || env.razorpayCurrency,
    name: 'PlacePrep',
    description: `${plan.label} access`,
    url: paymentLink.short_url,
    targetTier: plan.tier,
    billingCycle: plan.billingCycle,
    planKey: plan.planKey,
    mode: 'hosted',
  };
}

async function createCheckoutSession(user, payload = {}) {
  const plan = resolvePlan(payload);
  requireRazorpayConfigured();

  if (getCheckoutMode() === 'hosted') {
    return createRazorpayPaymentLinkSession(user, plan, payload);
  }

  return createRazorpayOrderSession(user, plan);
}

function verifyHmacPayload(payload, signature) {
  const expected = crypto
    .createHmac('sha256', env.razorpayKeySecret)
    .update(payload)
    .digest('hex');

  const received = String(signature || '');
  return expected.length === received.length
    && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function verifyPaymentSignature({ orderId, paymentId, signature }) {
  return verifyHmacPayload(`${orderId}|${paymentId}`, signature);
}

function verifyPaymentLinkSignature({ paymentLinkId, paymentLinkReferenceId, paymentLinkStatus, paymentId, signature }) {
  return verifyHmacPayload(`${paymentLinkId}|${paymentLinkReferenceId}|${paymentLinkStatus}|${paymentId}`, signature);
}

function assertExpectedPaymentDetails({ existing, payment, paymentLink = null, providerId }) {
  const expectedAmount = Number(existing.metadata?.amount || 0);
  const expectedCurrency = String(existing.metadata?.currency || env.razorpayCurrency).toUpperCase();
  const paymentAmount = Number(payment?.amount || paymentLink?.amount || 0);
  const paymentCurrency = String(payment?.currency || paymentLink?.currency || '').toUpperCase();

  if (!expectedAmount || paymentAmount !== expectedAmount) {
    throw new AppError('Razorpay payment amount does not match this plan.', 400, {
      code: 'razorpay_amount_mismatch',
      expectedAmount,
      paymentAmount,
      providerId,
    });
  }

  if (paymentCurrency !== expectedCurrency) {
    throw new AppError('Razorpay payment currency does not match this plan.', 400, {
      code: 'razorpay_currency_mismatch',
      expectedCurrency,
      paymentCurrency,
      providerId,
    });
  }

  if (payment?.status !== 'captured') {
    throw new AppError('Razorpay payment is not captured yet.', 402, {
      code: 'razorpay_payment_not_captured',
      status: payment?.status,
      providerId,
    });
  }

  return {
    expectedAmount,
    expectedCurrency,
  };
}

function buildBillingMetadata(currentUser, subscription, activeBillingTier = null) {
  const currentMetadata = currentUser?.coachMetadata || {};
  const previousTier = currentMetadata.billingPreviousTier
    || (currentMetadata.billingTier ? 'free' : normalizeTier(currentUser?.tier));

  return {
    ...currentMetadata,
    billingProvider: 'razorpay',
    billingTier: activeBillingTier,
    billingStatus: subscription?.status || null,
    billingCycle: subscription?.metadata?.billingCycle || null,
    billingPlanKey: subscription?.metadata?.planKey || null,
    billingPreviousTier: previousTier,
    billingRazorpayOrderId: subscription?.stripeSubscriptionId || currentMetadata.billingRazorpayOrderId || null,
    billingCurrentPeriodEnd: subscription?.currentPeriodEnd || null,
    billingUpdatedAt: new Date().toISOString(),
  };
}

async function reconcileUserTier(userId, latestSubscription = null, client = null) {
  const currentUser = await userRepository.findById(userId, client);
  if (!currentUser) {
    return null;
  }

  const subscriptions = await billingRepository.listSubscriptionsByUserId(userId, client);
  const activeSubscription = subscriptions
    .filter(isCurrentAccess)
    .sort((left, right) => TIER_RANK[right.tier] - TIER_RANK[left.tier])[0] || null;
  const expiredSubscription = subscriptions.find((subscription) => ACCESS_STATUSES.has(subscription.status) && isExpiredAccess(subscription));
  const holdSubscription = subscriptions.find((subscription) => HOLD_STATUSES.has(subscription.status));
  const baselineTier = normalizeTier(currentUser.coachMetadata?.billingPreviousTier || (
    currentUser.coachMetadata?.billingTier ? 'free' : currentUser.tier
  ));

  if (activeSubscription) {
    const billingTier = normalizeTier(activeSubscription.tier, 'pro');
    const nextTier = higherTier(baselineTier, billingTier);
    return userRepository.updateUser(userId, {
      tier: nextTier,
      coachMetadata: buildBillingMetadata(currentUser, activeSubscription, billingTier),
    }, client);
  }

  if (expiredSubscription) {
    return userRepository.updateUser(userId, {
      tier: baselineTier,
      coachMetadata: {
        ...buildBillingMetadata(currentUser, { ...expiredSubscription, status: 'expired' }, null),
        billingTier: null,
        billingStatus: 'expired',
        billingAccessEndedAt: expiredSubscription.currentPeriodEnd || new Date().toISOString(),
      },
    }, client);
  }

  if (holdSubscription) {
    return userRepository.updateUser(userId, {
      coachMetadata: buildBillingMetadata(currentUser, holdSubscription, currentUser.coachMetadata?.billingTier || normalizeTier(currentUser.tier)),
    }, client);
  }

  if (latestSubscription && TERMINAL_STATUSES.has(latestSubscription.status)) {
    return userRepository.updateUser(userId, {
      tier: baselineTier,
      coachMetadata: {
        ...buildBillingMetadata(currentUser, latestSubscription, null),
        billingTier: null,
        billingAccessEndedAt: new Date().toISOString(),
      },
    }, client);
  }

  return currentUser;
}

async function sendBillingReceiptForSubscription(subscription, payment = null) {
  if (!subscription || !ACCESS_STATUSES.has(subscription.status)) {
    return null;
  }

  const latest = await billingRepository.findSubscriptionByStripeId(subscription.stripeSubscriptionId);
  const current = latest || subscription;
  if (current.metadata?.receiptEmailSentAt) {
    return null;
  }

  const receiptUser = await userRepository.findById(current.userId);
  if (!receiptUser?.email) {
    return null;
  }

  const emailResult = await sendBillingReceiptEmail({
    user: receiptUser,
    subscription: current,
    payment,
  });

  const now = new Date().toISOString();
  await billingRepository.upsertSubscription({
    userId: current.userId,
    stripeCustomerId: current.stripeCustomerId,
    stripeSubscriptionId: current.stripeSubscriptionId,
    checkoutSessionId: current.checkoutSessionId,
    tier: current.tier,
    status: current.status,
    priceId: current.priceId,
    cancelAtPeriodEnd: current.cancelAtPeriodEnd,
    currentPeriodStart: current.currentPeriodStart,
    currentPeriodEnd: current.currentPeriodEnd,
    trialStart: current.trialStart,
    trialEnd: current.trialEnd,
    canceledAt: current.canceledAt,
    metadata: emailResult.sent
      ? {
          receiptEmailSentAt: now,
          receiptEmailReason: emailResult.reason,
        }
      : {
          receiptEmailLastAttemptAt: now,
          receiptEmailReason: emailResult.reason,
          receiptEmailLastError: emailResult.error || emailResult.reason,
        },
  });

  return emailResult;
}

function scheduleBillingReceiptEmail(subscription, payment = null) {
  void sendBillingReceiptForSubscription(subscription, payment).catch((error) => {
    console.error('[billing] Failed to schedule billing receipt email.', error);
  });
}

async function verifyOrderCheckoutPayment(user, { orderId, paymentId, signature }) {
  if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
    throw new AppError('Razorpay payment signature is invalid.', 400, {
      code: 'razorpay_signature_invalid',
    });
  }

  const result = await withTransaction(async (client) => {
    const existing = await billingRepository.findSubscriptionByStripeId(orderId, client);
    if (!existing || existing.userId !== user.id) {
      throw new AppError('Razorpay order does not belong to this account.', 404, {
        code: 'razorpay_order_missing',
      });
    }

    let payment;
    try {
      payment = await getRazorpayClient().payments.fetch(paymentId);
    } catch (error) {
      throw toRazorpayError(error);
    }

    const paymentOrderId = String(payment.order_id || '').trim();
    if (paymentOrderId !== orderId) {
      throw new AppError('Razorpay payment does not belong to this order.', 400, {
        code: 'razorpay_order_mismatch',
      });
    }

    const { expectedAmount, expectedCurrency } = assertExpectedPaymentDetails({
      existing,
      payment,
      providerId: orderId,
    });

    const periodStart = new Date();
    const periodEnd = addMonths(periodStart, Number(existing.metadata?.billingDurationMonths || 1));
    const persisted = await billingRepository.upsertSubscription({
      userId: user.id,
      stripeCustomerId: existing.stripeCustomerId || `razorpay_user_${user.id}`,
      stripeSubscriptionId: orderId,
      checkoutSessionId: orderId,
      tier: existing.tier,
      status: 'active',
      priceId: existing.priceId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      metadata: {
        provider: 'razorpay',
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        planKey: existing.metadata?.planKey || null,
        billingCycle: existing.metadata?.billingCycle || null,
        billingDurationMonths: existing.metadata?.billingDurationMonths || null,
        amount: expectedAmount,
        currency: expectedCurrency,
        paymentStatus: payment.status,
        method: payment.method,
      },
    }, client);

    await reconcileUserTier(user.id, persisted, client);

    return {
      verified: true,
      tier: persisted.tier,
      status: persisted.status,
      paymentId,
      orderId,
      subscription: persisted,
      payment,
    };
  });

  scheduleBillingReceiptEmail(result.subscription, result.payment);
  const { subscription, payment, ...publicResult } = result;
  return publicResult;
}

async function verifyPaymentLinkCheckoutPayment(user, {
  paymentLinkId,
  paymentLinkReferenceId,
  paymentLinkStatus,
  paymentId,
  signature,
}) {
  if (!verifyPaymentLinkSignature({ paymentLinkId, paymentLinkReferenceId, paymentLinkStatus, paymentId, signature })) {
    throw new AppError('Razorpay payment link signature is invalid.', 400, {
      code: 'razorpay_payment_link_signature_invalid',
    });
  }

  const result = await withTransaction(async (client) => {
    const existing = await billingRepository.findSubscriptionByStripeId(paymentLinkId, client);
    if (!existing || existing.userId !== user.id) {
      throw new AppError('Razorpay payment link does not belong to this account.', 404, {
        code: 'razorpay_payment_link_missing',
      });
    }

    const expectedReferenceId = String(existing.metadata?.razorpayPaymentLinkReferenceId || '').trim();
    if (!expectedReferenceId || paymentLinkReferenceId !== expectedReferenceId) {
      throw new AppError('Razorpay payment link reference does not match this checkout.', 400, {
        code: 'razorpay_payment_link_reference_mismatch',
      });
    }

    let payment;
    let paymentLink;
    try {
      [payment, paymentLink] = await Promise.all([
        getRazorpayClient().payments.fetch(paymentId),
        getRazorpayClient().paymentLink.fetch(paymentLinkId),
      ]);
    } catch (error) {
      throw toRazorpayError(error);
    }

    const fetchedLinkStatus = String(paymentLink.status || paymentLinkStatus || '').toLowerCase();
    if (fetchedLinkStatus !== 'paid') {
      throw new AppError('Razorpay payment link is not paid yet.', 402, {
        code: 'razorpay_payment_link_not_paid',
        status: fetchedLinkStatus,
      });
    }

    const { expectedAmount, expectedCurrency } = assertExpectedPaymentDetails({
      existing,
      payment,
      paymentLink,
      providerId: paymentLinkId,
    });

    const periodStart = new Date();
    const periodEnd = addMonths(periodStart, Number(existing.metadata?.billingDurationMonths || 1));
    const persisted = await billingRepository.upsertSubscription({
      userId: user.id,
      stripeCustomerId: existing.stripeCustomerId || `razorpay_user_${user.id}`,
      stripeSubscriptionId: paymentLinkId,
      checkoutSessionId: paymentLinkId,
      tier: existing.tier,
      status: 'active',
      priceId: existing.priceId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      metadata: {
        provider: 'razorpay',
        razorpayPaymentLinkId: paymentLinkId,
        razorpayPaymentLinkReferenceId: paymentLinkReferenceId,
        razorpayPaymentLinkStatus: fetchedLinkStatus,
        razorpayPaymentId: paymentId,
        planKey: existing.metadata?.planKey || null,
        billingCycle: existing.metadata?.billingCycle || null,
        billingDurationMonths: existing.metadata?.billingDurationMonths || null,
        amount: expectedAmount,
        currency: expectedCurrency,
        paymentStatus: payment.status,
        method: payment.method,
      },
    }, client);

    await reconcileUserTier(user.id, persisted, client);

    return {
      verified: true,
      tier: persisted.tier,
      status: persisted.status,
      paymentId,
      paymentLinkId,
      subscription: persisted,
      payment,
    };
  });

  scheduleBillingReceiptEmail(result.subscription, result.payment);
  const { subscription, payment, ...publicResult } = result;
  return publicResult;
}

async function verifyCheckoutPayment(user, payload = {}) {
  requireRazorpayConfigured();

  const orderId = String(payload.razorpay_order_id || payload.orderId || '').trim();
  const paymentId = String(payload.razorpay_payment_id || payload.paymentId || '').trim();
  const signature = String(payload.razorpay_signature || payload.signature || '').trim();
  const paymentLinkId = String(payload.razorpay_payment_link_id || payload.paymentLinkId || '').trim();
  const paymentLinkReferenceId = String(payload.razorpay_payment_link_reference_id || payload.paymentLinkReferenceId || '').trim();
  const paymentLinkStatus = String(payload.razorpay_payment_link_status || payload.paymentLinkStatus || '').trim();

  if (paymentLinkId || paymentLinkReferenceId || paymentLinkStatus) {
    if (!paymentLinkId || !paymentLinkReferenceId || !paymentLinkStatus || !paymentId || !signature) {
      throw new AppError('Razorpay payment link verification payload is incomplete.', 400, {
        code: 'razorpay_payment_link_verification_payload_invalid',
      });
    }

    return verifyPaymentLinkCheckoutPayment(user, {
      paymentLinkId,
      paymentLinkReferenceId,
      paymentLinkStatus,
      paymentId,
      signature,
    });
  }

  if (!orderId || !paymentId || !signature) {
    throw new AppError('Razorpay payment verification payload is incomplete.', 400, {
      code: 'razorpay_verification_payload_invalid',
    });
  }

  return verifyOrderCheckoutPayment(user, { orderId, paymentId, signature });
}

function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpayWebhookSecret) {
    throw new AppError('Razorpay webhook secret is not configured.', 503, {
      code: 'razorpay_webhook_not_configured',
    });
  }

  if (!signature) {
    throw new AppError('Razorpay signature header is required.', 400, {
      code: 'razorpay_signature_missing',
    });
  }

  const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(JSON.stringify(rawBody || {}));
  const expected = crypto
    .createHmac('sha256', env.razorpayWebhookSecret)
    .update(raw)
    .digest('hex');

  const received = String(signature);
  if (expected.length !== received.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
    throw new AppError('Invalid Razorpay webhook signature.', 400, {
      code: 'razorpay_webhook_signature_invalid',
    });
  }

  return JSON.parse(raw.toString('utf8'));
}

async function findExistingSubscriptionForWebhook(event, client = null) {
  const payment = event?.payload?.payment?.entity || null;
  const order = event?.payload?.order?.entity || null;
  const paymentLink = event?.payload?.payment_link?.entity || null;
  const notes = payment?.notes || order?.notes || paymentLink?.notes || {};
  const candidates = [
    payment?.order_id,
    order?.id,
    paymentLink?.id,
    payment?.payment_link_id,
    notes.razorpayPaymentLinkId,
  ].map((value) => String(value || '').trim()).filter(Boolean);

  for (const candidate of candidates) {
    const subscription = await billingRepository.findSubscriptionByStripeId(candidate, client);
    if (subscription) {
      return { subscription, providerId: candidate, payment, order, paymentLink, notes };
    }
  }

  const referenceId = String(
    paymentLink?.reference_id
      || payment?.payment_link_reference_id
      || notes.razorpayPaymentLinkReferenceId
      || ''
  ).trim();

  if (referenceId) {
    const subscription = await billingRepository.findSubscriptionByMetadataValue('razorpayPaymentLinkReferenceId', referenceId, client);
    if (subscription) {
      return { subscription, providerId: subscription.stripeSubscriptionId, payment, order, paymentLink, notes };
    }
  }

  return null;
}

async function processWebhookEvent(event, client = null) {
  const resolved = await findExistingSubscriptionForWebhook(event, client);
  if (!resolved) {
    return null;
  }

  const { subscription: existing, providerId, payment, order, paymentLink } = resolved;
  const entity = payment || paymentLink || order || {};
  const expectedAmount = Number(existing.metadata?.amount || 0);
  const expectedCurrency = String(existing.metadata?.currency || env.razorpayCurrency).toUpperCase();
  const entityAmount = entity.amount ? Number(entity.amount) : null;
  const entityCurrency = entity.currency ? String(entity.currency).toUpperCase() : null;

  if (entityAmount && expectedAmount && entityAmount !== expectedAmount) {
    console.warn('Ignoring Razorpay webhook with mismatched amount', {
      providerId,
      expectedAmount,
      entityAmount,
      event: event.event,
    });
    return null;
  }

  if (entityCurrency && entityCurrency !== expectedCurrency) {
    console.warn('Ignoring Razorpay webhook with mismatched currency', {
      providerId,
      expectedCurrency,
      entityCurrency,
      event: event.event,
    });
    return null;
  }

  const rawStatus = String(entity.status || existing.status || '').toLowerCase();
  const status = rawStatus === 'captured' || rawStatus === 'paid' ? 'active' : rawStatus;
  const periodStart = ACCESS_STATUSES.has(status) && !existing.currentPeriodStart
    ? new Date()
    : existing.currentPeriodStart;
  const periodEnd = ACCESS_STATUSES.has(status) && !existing.currentPeriodEnd
    ? addMonths(periodStart, Number(existing.metadata?.billingDurationMonths || 1))
    : existing.currentPeriodEnd;
  const persisted = await billingRepository.upsertSubscription({
    userId: existing.userId,
    stripeCustomerId: existing.stripeCustomerId,
    stripeSubscriptionId: existing.stripeSubscriptionId,
    checkoutSessionId: existing.checkoutSessionId || providerId,
    tier: existing.tier,
    status,
    priceId: existing.priceId,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    metadata: {
      provider: 'razorpay',
      webhookEvent: event.event,
      razorpayOrderId: payment?.order_id || order?.id || existing.metadata?.razorpayOrderId || null,
      razorpayPaymentLinkId: paymentLink?.id || payment?.payment_link_id || existing.metadata?.razorpayPaymentLinkId || null,
      razorpayPaymentLinkReferenceId: paymentLink?.reference_id || existing.metadata?.razorpayPaymentLinkReferenceId || null,
      razorpayPaymentId: payment?.id || existing.metadata?.razorpayPaymentId || null,
      planKey: existing.metadata?.planKey || null,
      billingCycle: existing.metadata?.billingCycle || null,
      billingDurationMonths: existing.metadata?.billingDurationMonths || null,
      amount: expectedAmount,
      currency: expectedCurrency,
    },
  }, client);

  await reconcileUserTier(existing.userId, persisted, client);
  return persisted;
}

async function handleWebhook(rawBody, signature) {
  const event = verifyWebhookSignature(rawBody, signature);
  event.id = event.id || `${event.event}:${event.created_at || Date.now()}:${event.payload?.payment?.entity?.id || event.payload?.order?.entity?.id || event.payload?.payment_link?.entity?.id || 'unknown'}`;
  event.type = event.event || 'razorpay.event';

  const result = await withTransaction(async (client) => {
    const recorded = await billingRepository.recordEvent(event, {
      source: 'razorpay-webhook',
    }, client);

    if (!recorded.recorded) {
      return {
        duplicate: true,
        processed: false,
      };
    }

    const processed = await processWebhookEvent(event, client);
    return {
      duplicate: false,
      processed: Boolean(processed),
      subscription: processed,
    };
  });

  if (result.subscription && ACCESS_STATUSES.has(result.subscription.status)) {
    scheduleBillingReceiptEmail(result.subscription);
  }

  return {
    received: true,
    type: event.type,
    ...result,
  };
}

async function createPortalSession() {
  throw new AppError('Razorpay customer portal is not available for this billing integration.', 404, {
    code: 'razorpay_portal_unavailable',
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
