# Production Deployment Guide

## Overview

Your AI Calendar Planner has been updated to support user-specific OpenRouter API keys with encrypted storage. Users can now manage their own API keys and model preferences through a Settings page.

## What Changed

### Backend Changes
1. **PostgreSQL Database**: Added user management with encrypted API key storage
2. **Session Storage**: Migrated from in-memory to PostgreSQL-backed sessions
3. **User Settings**: New API endpoints for managing user settings
4. **Per-User API Keys**: Chat endpoint now uses each user's personal OpenRouter key
5. **Encryption**: AES-256-CBC encryption for API keys at rest

### Frontend Changes
1. **Settings Page**: New UI for users to configure their OpenRouter API key and model
2. **Error Handling**: Graceful messaging when API key is not configured
3. **Settings Button**: Added to header for easy access

### New Files Created
- `backend/db/schema.sql` - Database schema
- `backend/db/connection.js` - Database connection and queries
- `backend/utils/encryption.js` - API key encryption utilities
- `backend/scripts/init-db.js` - Database initialization script
- `frontend/src/components/Settings.jsx` - Settings UI component
- `frontend/src/components/Settings.css` - Settings styling
- `backend/.env.example` - Environment variable template

## Prerequisites for Production

1. **PostgreSQL Database** (version 12+)
   - Can be hosted on:
     - [Supabase](https://supabase.com) (free tier available)
     - [Neon](https://neon.tech) (generous free tier)
     - [Railway](https://railway.app)
     - [Render](https://render.com)
     - AWS RDS, Google Cloud SQL, etc.

2. **Node.js** (version 18+)

3. **Google OAuth Credentials** (already configured)

## Local Setup & Testing

### 1. Set Up PostgreSQL

**Option A: Using Local PostgreSQL**
```bash
# Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

# Create database
createdb ai_planner
```

**Option B: Using Docker**
```bash
docker run -d \
  --name ai-planner-postgres \
  -e POSTGRES_DB=ai_planner \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  postgres:15
```

**Option C: Using Supabase (Free)**
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy the connection string from Settings → Database
4. Use the connection string in your `.env` file

### 2. Configure Environment Variables

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set:

```bash
# Generate a 32-byte encryption key
openssl rand -hex 32
# Copy the output and paste it as ENCRYPTION_KEY

# Update these values:
DATABASE_URL=postgresql://username:password@localhost:5432/ai_planner
ENCRYPTION_KEY=<paste the generated key here>
```

### 3. Initialize Database

```bash
cd backend
node scripts/init-db.js
```

You should see:
```
✅ Database connection successful
✅ Database tables created successfully
📋 Tables created:
   - session
   - user_settings
   - users
```

### 4. Start the Application

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

### 5. Test the User Flow

1. Navigate to `http://localhost:5173`
2. Click "Connect Google Calendar"
3. After authentication, click "Settings" in the top right
4. Enter your OpenRouter API key (get from [openrouter.ai/keys](https://openrouter.ai/keys))
5. Enter a model name (e.g., `anthropic/claude-3.5-sonnet`)
6. Click "Save Settings"
7. Try using the chat feature

## Production Deployment

### Step 1: Set Up Production Database

**Recommended: Supabase (Free)**

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings → Database
4. Copy the connection string (URI format)
5. Run initialization:
   ```bash
   DATABASE_URL="postgresql://..." node scripts/init-db.js
   ```

**Alternative: Neon, Railway, or other PostgreSQL provider**

Follow their setup instructions and use the provided connection string.

### Step 2: Deploy Backend

**Option A: Railway (Recommended)**

1. Create account at [railway.app](https://railway.app)
2. Create new project from GitHub repo
3. Add PostgreSQL service (or use external Supabase)
4. Configure environment variables:
   - `DATABASE_URL` - PostgreSQL connection string
   - `ENCRYPTION_KEY` - Generate with `openssl rand -hex 32`
   - `SESSION_SECRET` - Generate with `openssl rand -hex 32`
   - `GOOGLE_CLIENT_ID` - Your Google OAuth ID
   - `GOOGLE_CLIENT_SECRET` - Your Google OAuth secret
   - `GOOGLE_REDIRECT_URI` - `https://your-backend.railway.app/api/auth/callback`
   - `FRONTEND_URL` - `https://your-frontend-url.vercel.app`
5. Deploy backend

**Option B: Render**

1. Create account at [render.com](https://render.com)
2. Create new Web Service from Git
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables (same as Railway)
6. Deploy

**Option C: Heroku**

```bash
# Install Heroku CLI
heroku create your-app-name

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Set environment variables
heroku config:set ENCRYPTION_KEY=$(openssl rand -hex 32)
heroku config:set SESSION_SECRET=$(openssl rand -hex 32)
heroku config:set GOOGLE_CLIENT_ID=your-id
heroku config:set GOOGLE_CLIENT_SECRET=your-secret
heroku config:set GOOGLE_REDIRECT_URI=https://your-app.herokuapp.com/api/auth/callback
heroku config:set FRONTEND_URL=https://your-frontend.vercel.app

# Deploy
git push heroku main

# Initialize database
heroku run node scripts/init-db.js
```

### Step 3: Deploy Frontend

**Vercel (Recommended)**

1. Create account at [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Set root directory to `frontend`
4. Add environment variable:
   - `VITE_API_BASE` → `https://your-backend.railway.app`
5. Deploy

Update `frontend/src/App.jsx`:
```javascript
const API_BASE = import.meta.env.VITE_API_BASE || '/api';
```

**Netlify**

1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```
2. Drag the `dist` folder to Netlify
3. Configure API proxy in `netlify.toml`:
   ```toml
   [[redirects]]
     from = "/api/*"
     to = "https://your-backend.railway.app/api/:splat"
     status = 200
   ```

### Step 4: Update Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Edit your OAuth 2.0 Client ID
3. Add authorized redirect URIs:
   - `https://your-backend-domain/api/auth/callback`
4. Add authorized JavaScript origins:
   - `https://your-frontend-domain`

### Step 5: Test Production

1. Visit your production URL
2. Connect Google Calendar
3. Configure OpenRouter API key in Settings
4. Test creating events via chat

## Security Checklist

- [ ] `ENCRYPTION_KEY` is set to a secure 64-character hex string
- [ ] `SESSION_SECRET` is set to a secure random string
- [ ] Database uses SSL connection (most providers enable by default)
- [ ] CORS is restricted to your frontend domain only
- [ ] Cookie `secure` flag is set to `true` in production (requires HTTPS)
- [ ] API keys are never logged in production
- [ ] Database backups are configured

## Environment Variables Reference

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `ENCRYPTION_KEY` - 64-char hex for encrypting API keys (generate: `openssl rand -hex 32`)
- `SESSION_SECRET` - Random string for session signing
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - OAuth callback URL
- `FRONTEND_URL` - Frontend domain for CORS

### Optional
- `PORT` - Backend port (default: 3001)

## Monitoring & Maintenance

### Database
- Monitor connection pool usage
- Set up automated backups
- Periodically clean old sessions (connect-pg-simple does this automatically)

### Security
- Rotate `ENCRYPTION_KEY` periodically (requires re-encrypting all API keys)
- Monitor for failed decryption attempts
- Review database access logs

### Performance
- Add indexes if queries become slow
- Monitor OpenRouter API usage per user
- Consider rate limiting user requests

## Troubleshooting

### "ENCRYPTION_KEY must be 32 bytes"
Generate a proper key: `openssl rand -hex 32`

### "Database connection failed"
- Check `DATABASE_URL` format
- Ensure database exists
- Verify network access/firewall rules
- Check if database service is running

### "Session not persisting"
- Verify PostgreSQL session store is configured
- Check cookie settings (`secure` flag for HTTPS)
- Ensure `SESSION_SECRET` is set

### Users can't save API keys
- Verify `ENCRYPTION_KEY` is set
- Check database `user_settings` table exists
- Review server logs for encryption errors

## Support

For issues or questions:
1. Check server logs: `heroku logs --tail` (or provider equivalent)
2. Verify environment variables are set correctly
3. Test database connection: `node scripts/init-db.js`
4. Ensure all migrations ran successfully

## Rollback Plan

If you need to rollback to the old system:
1. Restore `backend/server.js` from git history
2. Remove database dependencies from `package.json`
3. Use your old OpenRouter API key in `.env`
4. Redeploy

However, users will lose their personal API key configurations.
