/*

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

async function testConnection() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW()');
    console.log(`📡 Database time: ${result.rows[0].now}`);
  } finally {
    client.release();
  }
}

async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development' && duration > 500) {
    console.warn(`⚠️  Slow query (${duration}ms):`, text.substring(0, 80));
  }
  return result;
}

*/
const { Pool } = require('pg');
const env = require('./env');

function normalizeConnectionString(connectionString) {
  try {
    const parsed = new URL(connectionString);

    // The pg connection-string parser treats sslmode as authoritative and can
    // override the explicit ssl object below, which breaks Supabase/Railway TLS.
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('sslcert');
    parsed.searchParams.delete('sslkey');
    parsed.searchParams.delete('sslrootcert');

    return parsed.toString();
  } catch {
    return connectionString;
  }
}

const pool = new Pool({
  connectionString: normalizeConnectionString(env.databasePoolUrl || env.databaseUrl),
  ssl: env.nodeEnv === 'production'
    ? {
        rejectUnauthorized: false,
      }
    : false,
  max: env.databasePoolMax,
  idleTimeoutMillis: env.databaseIdleTimeoutMs,
  connectionTimeoutMillis: env.databaseConnectionTimeoutMs,
});

pool.on('error', (error) => {
  console.error('Unexpected database pool error:', error);
});

async function testConnection() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW() AS now');
    console.log(`Database time: ${result.rows[0].now}`);
  } finally {
    client.release();
  }
}

async function query(text, params = []) {
  const startedAt = Date.now();
  const result = await pool.query(text, params);

  if (env.nodeEnv === 'development') {
    const duration = Date.now() - startedAt;
    if (duration > 500) {
      console.warn(`Slow query (${duration}ms): ${text.slice(0, 80)}`);
    }
  }

  return result;
}

async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  testConnection,
  withTransaction,
};
