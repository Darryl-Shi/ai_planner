-- Migration: Add Outlook Calendar Support
-- This migration adds support for multiple calendar providers (Google and Outlook)

-- Add new columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS outlook_id VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'google';

-- Make google_id nullable for Outlook-only users
ALTER TABLE users
  ALTER COLUMN google_id DROP NOT NULL;

-- Add constraint to ensure provider has matching ID
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS provider_id_check;

ALTER TABLE users
  ADD CONSTRAINT provider_id_check CHECK (
    (provider = 'google' AND google_id IS NOT NULL) OR
    (provider = 'outlook' AND outlook_id IS NOT NULL)
  );

-- Create indexes for outlook_id and provider
CREATE INDEX IF NOT EXISTS IDX_users_outlook_id ON users(outlook_id);
CREATE INDEX IF NOT EXISTS IDX_users_provider ON users(provider);

-- Update existing users to have 'google' as provider (they all use Google currently)
UPDATE users SET provider = 'google' WHERE provider IS NULL OR provider = '';
