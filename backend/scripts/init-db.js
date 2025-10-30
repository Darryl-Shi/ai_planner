#!/usr/bin/env node

/**
 * Database Initialization Script
 *
 * This script creates the necessary database tables for the AI Calendar Planner.
 * Run this script once after setting up your PostgreSQL database.
 *
 * Usage:
 *   node scripts/init-db.js
 */

import dotenv from 'dotenv';
import pg from 'pg';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function initializeDatabase() {
  console.log('🚀 Starting database initialization...\n');

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set');
    console.error('Please set DATABASE_URL in your .env file');
    console.error('Example: DATABASE_URL=postgresql://username:password@localhost:5432/ai_planner\n');
    process.exit(1);
  }

  console.log(`📍 Connecting to database: ${process.env.DATABASE_URL.split('@')[1] || 'unknown'}\n`);

  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connection successful\n');

    // Read schema file
    const schemaPath = join(__dirname, '..', 'db', 'schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf8');

    console.log('📄 Executing schema.sql...');

    // Execute schema
    await client.query(schemaSql);

    console.log('✅ Database tables created successfully\n');

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('📋 Tables created:');
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    client.release();

    console.log('\n✨ Database initialization complete!\n');
    console.log('Next steps:');
    console.log('1. Ensure ENCRYPTION_KEY is set in your .env file');
    console.log('   Generate with: openssl rand -hex 32');
    console.log('2. Start the backend server: npm run dev');
    console.log('3. Users can now configure their OpenRouter API keys in the Settings page\n');

  } catch (error) {
    console.error('\n❌ Error initializing database:');
    console.error(error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\nMake sure PostgreSQL is running and DATABASE_URL is correct.');
    } else if (error.code === '3D000') {
      console.error('\nDatabase does not exist. Please create it first.');
      console.error('Example: createdb ai_planner');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run initialization
initializeDatabase();
