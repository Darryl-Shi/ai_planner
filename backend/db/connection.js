import pg from 'pg';
const { Pool } = pg;

// Determine pool configuration. Prefer discrete PG* env vars to avoid URL encoding issues
// with special characters in passwords. Fallback to DATABASE_URL if provided.
const buildPoolConfig = () => {
  const hasDiscrete = process.env.PGHOST || process.env.PGUSER || process.env.PGPASSWORD || process.env.PGDATABASE;
  if (hasDiscrete && !process.env.DATABASE_URL) {
    return {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      user: process.env.PGUSER || 'ai_planner',
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || 'ai_planner',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    };
  }

  return {
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  };
};

// Create PostgreSQL connection pool
const pool = new Pool(buildPoolConfig());

// Test connection on startup
pool.on('connect', () => {
  console.log('Database connected successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper function to execute queries
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Helper function to get a client from the pool (for transactions)
export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

// User-related database functions
export const findOrCreateUser = async (providerId, email, name, provider = 'google') => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Determine the ID column based on provider
    const idColumn = provider === 'outlook' ? 'outlook_id' : 'google_id';

    // Try to find existing user
    let result = await client.query(
      `SELECT * FROM users WHERE ${idColumn} = $1`,
      [providerId]
    );

    if (result.rows.length > 0) {
      // User exists, update their info
      result = await client.query(
        `UPDATE users SET email = $1, name = $2, updated_at = CURRENT_TIMESTAMP WHERE ${idColumn} = $3 RETURNING *`,
        [email, name, providerId]
      );
    } else {
      // Create new user
      result = await client.query(
        `INSERT INTO users (${idColumn}, email, name, provider) VALUES ($1, $2, $3, $4) RETURNING *`,
        [providerId, email, name, provider]
      );

      // Create empty user_settings record
      await client.query(
        'INSERT INTO user_settings (user_id) VALUES ($1)',
        [result.rows[0].id]
      );
    }

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Get user by ID
export const getUserById = async (userId) => {
  const result = await query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0] || null;
};

export const getUserSettings = async (userId) => {
  const result = await query(
    'SELECT * FROM user_settings WHERE user_id = $1',
    [userId]
  );
  return result.rows[0] || null;
};

export const updateUserSettings = async (userId, openrouterApiKeyEncrypted, openrouterModel, encryptionIv) => {
  const result = await query(
    `UPDATE user_settings
     SET openrouter_api_key_encrypted = $1,
         openrouter_model = $2,
         encryption_iv = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $4
     RETURNING *`,
    [openrouterApiKeyEncrypted, openrouterModel, encryptionIv, userId]
  );
  return result.rows[0];
};

export const deleteUserApiKey = async (userId) => {
  const result = await query(
    `UPDATE user_settings
     SET openrouter_api_key_encrypted = NULL,
         encryption_iv = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1
     RETURNING *`,
    [userId]
  );
  return result.rows[0];
};

export default pool;
