const crypto = require('crypto');
const Razorpay = require('razorpay');

const env = require('../config/env');
const { withTransaction } = require('../config/database');
const billingRepository = require('../repositories/billing.repository');
const userRepository = require('../repositories/user.repository');
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
    checkoutMode: 'payment',
    keyId: env.razorpayKeyId || null,
    currency: env.razorpayCurrency,
    availablePlans,
  };
}

async function getAccount(user) {
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
}

async function createCheckoutSession(user, payload = {}) {
  const plan = resolvePlan(payload);
  requireRazorpayConfigured();

  const receipt = `placeprep_${plan.planKey}_${Date.now()}_${String(user.id).slice(0, 8)}`;
  let order;
  try {
    order = await getRazorpayClient().orders.create({
      amount: plan.amount,
      currency: env.razorpayCurrency,
      receipt,
      notes: {
        placeprepUserId: user.id,
        placeprepUserEmail: user.email,
        targetTier: plan.tier,
        billingCycle: plan.billingCycle,
        planKey: plan.planKey,
        source: 'placeprep-billing',
      },
    });
  } catch (error) {
    throw toRazorpayError(error);
  }

  await billingRepository.upsertCustomer({
    userId: user.id,
    stripeCustomerId: `razorpay_user_${user.id}`,
    email: user.email,
    metadata: {
      provider: 'razorpay',
      source: 'order-created',
    },
  });

  await billingRepository.upsertSubscription({
    userId: user.id,
    stripeCustomerId: `razorpay_user_${user.id}`,
    stripeSubscriptionId: order.id,
    checkoutSessionId: order.id,
    tier: plan.tier,
    status: order.status || 'created',
    priceId: `${env.razorpayCurrency}_${plan.planKey}_${plan.amount}`,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    metadata: {
      provider: 'razorpay',
      razorpayOrderId: order.id,
      planKey: plan.planKey,
      billingCycle: plan.billingCycle,
      billingDurationMonths: plan.durationMonths,
      amount: plan.amount,
      currency: env.razorpayCurrency,
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

function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const expected = crypto
    .createHmac('sha256', env.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const received = String(signature || '');
  return expected.length === received.length
    && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
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

async function verifyCheckoutPayment(user, payload = {}) {
  requireRazorpayConfigured();

  const orderId = String(payload.razorpay_order_id || payload.orderId || '').trim();
  const paymentId = String(payload.razorpay_payment_id || payload.paymentId || '').trim();
  const signature = String(payload.razorpay_signature || payload.signature || '').trim();

  if (!orderId || !paymentId || !signature) {
    throw new AppError('Razorpay payment verification payload is incomplete.', 400, {
      code: 'razorpay_verification_payload_invalid',
    });
  }

  if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
    throw new AppError('Razorpay payment signature is invalid.', 400, {
      code: 'razorpay_signature_invalid',
    });
  }

  return withTransaction(async (client) => {
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
    const status = payment.status === 'captured' ? 'active' : payment.status;
    const periodStart = new Date();
    const periodEnd = ACCESS_STATUSES.has(status)
      ? addMonths(periodStart, Number(existing.metadata?.billingDurationMonths || 1))
      : null;
    const persisted = await billingRepository.upsertSubscription({
      userId: user.id,
      stripeCustomerId: existing.stripeCustomerId || `razorpay_user_${user.id}`,
      stripeSubscriptionId: orderId,
      checkoutSessionId: orderId,
      tier: existing.tier,
      status,
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
    };
  });
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

async function processWebhookEvent(event, client = null) {
  const entity = event?.payload?.payment?.entity || event?.payload?.order?.entity || {};
  const orderId = entity.order_id || entity.id;
  if (!orderId) {
    return null;
  }

  const existing = await billingRepository.findSubscriptionByStripeId(orderId, client);
  if (!existing) {
    return null;
  }

  const status = entity.status === 'captured' ? 'active' : entity.status || existing.status;
  const periodStart = ACCESS_STATUSES.has(status) && !existing.currentPeriodStart
    ? new Date()
    : existing.currentPeriodStart;
  const periodEnd = ACCESS_STATUSES.has(status) && !existing.currentPeriodEnd
    ? addMonths(periodStart, Number(existing.metadata?.billingDurationMonths || 1))
    : existing.currentPeriodEnd;
  const persisted = await billingRepository.upsertSubscription({
    userId: existing.userId,
    stripeCustomerId: existing.stripeCustomerId,
    stripeSubscriptionId: orderId,
    checkoutSessionId: existing.checkoutSessionId || orderId,
    tier: existing.tier,
    status,
    priceId: existing.priceId,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    metadata: {
      provider: 'razorpay',
      webhookEvent: event.event,
      razorpayPaymentId: entity.id,
      planKey: existing.metadata?.planKey || null,
      billingCycle: existing.metadata?.billingCycle || null,
      billingDurationMonths: existing.metadata?.billingDurationMonths || null,
    },
  }, client);

  await reconcileUserTier(existing.userId, persisted, client);
  return persisted;
}

async function handleWebhook(rawBody, signature) {
  const event = verifyWebhookSignature(rawBody, signature);
  event.id = event.id || `${event.event}:${event.created_at || Date.now()}:${event.payload?.payment?.entity?.id || event.payload?.order?.entity?.id || 'unknown'}`;
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
