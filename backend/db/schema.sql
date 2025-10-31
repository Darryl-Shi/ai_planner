-- AI Calendar Planner Database Schema

-- Users table: stores user profile information from OAuth (Google or Outlook)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  google_id VARCHAR(255) UNIQUE,
  outlook_id VARCHAR(255) UNIQUE,
  provider VARCHAR(50) NOT NULL DEFAULT 'google',
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT provider_id_check CHECK (
    (provider = 'google' AND google_id IS NOT NULL) OR
    (provider = 'outlook' AND outlook_id IS NOT NULL)
  )
);

-- User settings table: stores encrypted OpenRouter API keys and model preferences
CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  openrouter_api_key_encrypted TEXT,
  openrouter_model VARCHAR(255),
  encryption_iv VARCHAR(32),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table: stores user sessions (managed by connect-pg-simple)
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

-- Create index on session expiration for cleanup
CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);

-- Create indexes on provider IDs for faster lookups
CREATE INDEX IF NOT EXISTS IDX_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS IDX_users_outlook_id ON users(outlook_id);
CREATE INDEX IF NOT EXISTS IDX_users_provider ON users(provider);

-- Create index on user_id in user_settings
CREATE INDEX IF NOT EXISTS IDX_user_settings_user_id ON user_settings(user_id);
