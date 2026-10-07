const { query } = require('../config/database');

const appSettingColumns = `
  key,
  value,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function findByKey(key) {
  const result = await query(
    `SELECT ${appSettingColumns}
     FROM app_settings
     WHERE key = $1`,
    [key]
  );

  return result.rows[0] || null;
}

async function upsertSetting(key, value) {
  const result = await query(
    `INSERT INTO app_settings (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value
     RETURNING ${appSettingColumns}`,
    [key, value]
  );

  return result.rows[0] || null;
}

module.exports = {
  findByKey,
  upsertSetting,
};
