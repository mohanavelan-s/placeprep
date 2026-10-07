const { randomUUID } = require('crypto');
const { query } = require('../config/database');

function getExecutor(client) {
  return client ? client.query.bind(client) : query;
}

const customerColumns = `
  id,
  user_id AS "userId",
  stripe_customer_id AS "stripeCustomerId",
  email,
  metadata,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const subscriptionColumns = `
  id,
  user_id AS "userId",
  stripe_customer_id AS "stripeCustomerId",
  stripe_subscription_id AS "stripeSubscriptionId",
  checkout_session_id AS "checkoutSessionId",
  tier,
  status,
  price_id AS "priceId",
  cancel_at_period_end AS "cancelAtPeriodEnd",
  current_period_start AS "currentPeriodStart",
  current_period_end AS "currentPeriodEnd",
  trial_start AS "trialStart",
  trial_end AS "trialEnd",
  canceled_at AS "canceledAt",
  metadata,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'number') {
    return new Date(value * 1000).toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function findCustomerByUserId(userId, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `SELECT ${customerColumns}
     FROM billing_customers
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );

  return result.rows[0] || null;
}

async function findCustomerByStripeId(stripeCustomerId, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `SELECT ${customerColumns}
     FROM billing_customers
     WHERE stripe_customer_id = $1
     LIMIT 1`,
    [stripeCustomerId],
  );

  return result.rows[0] || null;
}

async function upsertCustomer(payload, client = null) {
  const execute = getExecutor(client);
  const existingByUser = await findCustomerByUserId(payload.userId, client);

  if (existingByUser) {
    const updated = await execute(
      `UPDATE billing_customers
       SET stripe_customer_id = $2,
           email = COALESCE($3, email),
           metadata = metadata || $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING ${customerColumns}`,
      [
        existingByUser.id,
        payload.stripeCustomerId,
        payload.email || null,
        payload.metadata || {},
      ],
    );

    return updated.rows[0];
  }

  const result = await execute(
    `INSERT INTO billing_customers (
      id,
      user_id,
      stripe_customer_id,
      email,
      metadata
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (stripe_customer_id)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      email = COALESCE(EXCLUDED.email, billing_customers.email),
      metadata = billing_customers.metadata || EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING ${customerColumns}`,
    [
      randomUUID(),
      payload.userId,
      payload.stripeCustomerId,
      payload.email || null,
      payload.metadata || {},
    ],
  );

  return result.rows[0];
}

async function findSubscriptionByStripeId(stripeSubscriptionId, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `SELECT ${subscriptionColumns}
     FROM billing_subscriptions
     WHERE stripe_subscription_id = $1
     LIMIT 1`,
    [stripeSubscriptionId],
  );

  return result.rows[0] || null;
}

async function findSubscriptionByMetadataValue(key, value, client = null) {
  const allowedKeys = new Set([
    'razorpayPaymentLinkId',
    'razorpayPaymentLinkReferenceId',
    'razorpayOrderId',
  ]);

  if (!allowedKeys.has(key) || !value) {
    return null;
  }

  const execute = getExecutor(client);
  const result = await execute(
    `SELECT ${subscriptionColumns}
     FROM billing_subscriptions
     WHERE metadata ->> $1 = $2
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [key, value],
  );

  return result.rows[0] || null;
}

async function upsertSubscription(payload, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `INSERT INTO billing_subscriptions (
      id,
      user_id,
      stripe_customer_id,
      stripe_subscription_id,
      checkout_session_id,
      tier,
      status,
      price_id,
      cancel_at_period_end,
      current_period_start,
      current_period_end,
      trial_start,
      trial_end,
      canceled_at,
      metadata
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15
    )
    ON CONFLICT (stripe_subscription_id)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      checkout_session_id = COALESCE(EXCLUDED.checkout_session_id, billing_subscriptions.checkout_session_id),
      tier = EXCLUDED.tier,
      status = EXCLUDED.status,
      price_id = EXCLUDED.price_id,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      trial_start = EXCLUDED.trial_start,
      trial_end = EXCLUDED.trial_end,
      canceled_at = EXCLUDED.canceled_at,
      metadata = billing_subscriptions.metadata || EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING ${subscriptionColumns}`,
    [
      randomUUID(),
      payload.userId,
      payload.stripeCustomerId,
      payload.stripeSubscriptionId,
      payload.checkoutSessionId || null,
      payload.tier,
      payload.status,
      payload.priceId || null,
      Boolean(payload.cancelAtPeriodEnd),
      normalizeDate(payload.currentPeriodStart),
      normalizeDate(payload.currentPeriodEnd),
      normalizeDate(payload.trialStart),
      normalizeDate(payload.trialEnd),
      normalizeDate(payload.canceledAt),
      payload.metadata || {},
    ],
  );

  return result.rows[0];
}

async function listSubscriptionsByUserId(userId, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `SELECT ${subscriptionColumns}
     FROM billing_subscriptions
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );

  return result.rows;
}

async function findLatestSubscriptionByUserId(userId, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `SELECT ${subscriptionColumns}
     FROM billing_subscriptions
     WHERE user_id = $1
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [userId],
  );

  return result.rows[0] || null;
}

async function recordEvent(event, metadata = {}, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `INSERT INTO billing_events (
      id,
      stripe_event_id,
      event_type,
      payload,
      metadata
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (stripe_event_id) DO NOTHING
    RETURNING id`,
    [
      randomUUID(),
      event.id,
      event.type,
      event,
      metadata,
    ],
  );

  return {
    recorded: Boolean(result.rowCount),
    id: result.rows[0]?.id || null,
  };
}

module.exports = {
  findCustomerByUserId,
  findCustomerByStripeId,
  upsertCustomer,
  findSubscriptionByStripeId,
  findSubscriptionByMetadataValue,
  upsertSubscription,
  listSubscriptionsByUserId,
  findLatestSubscriptionByUserId,
  recordEvent,
};
