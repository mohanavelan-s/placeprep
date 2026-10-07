const fs = require('fs/promises');
const path = require('path');
const { pool } = require('../config/database');

function formatErrorMessage(error) {
  if (error?.errors?.length) {
    return error.errors.map((item) => item.message).join('; ');
  }

  return error?.message || error?.code || String(error);
}

async function initializeDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = await fs.readFile(schemaPath, 'utf8');
  await pool.query(schemaSql);
}

if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('Database schema initialized successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to initialize database schema:', formatErrorMessage(error));
      process.exit(1);
    });
}

module.exports = {
  initializeDatabase,
};
