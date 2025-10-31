# Outlook Calendar Integration

This document describes the Outlook/Microsoft Calendar integration added to the AI Calendar Assistant.

## Overview

The application now supports both **Google Calendar** and **Outlook/Microsoft Calendar** as calendar providers. Users can choose their preferred calendar service during login.

## Features

- ✅ Full support for Microsoft/Outlook Calendar via Microsoft Graph API
- ✅ OAuth 2.0 authentication with Azure AD
- ✅ Provider abstraction layer for easy extensibility
- ✅ Unified calendar operations (list, create, update, delete events)
- ✅ Event format translation between Google and Outlook formats
- ✅ User can choose between Google or Outlook at login

## Architecture

### Provider Abstraction Layer

The application uses a provider abstraction pattern to support multiple calendar services:

```
CalendarProvider (base interface)
├── GoogleCalendarProvider (Google Calendar implementation)
└── OutlookCalendarProvider (Outlook Calendar implementation)
```

All calendar operations go through this abstraction layer, making it easy to add more providers in the future.

### Key Files Added/Modified

**Backend:**
- `backend/providers/CalendarProvider.js` - Base provider interface
- `backend/providers/GoogleCalendarProvider.js` - Google Calendar implementation
- `backend/providers/OutlookCalendarProvider.js` - Outlook Calendar implementation
- `backend/providers/ProviderFactory.js` - Factory for creating provider instances
- `backend/db/migrations/001_add_outlook_support.sql` - Database migration
- `backend/server.js` - Updated with multi-provider authentication and routing

**Frontend:**
- `frontend/src/App.jsx` - Updated with provider selection UI
- `frontend/src/App.css` - Styled login buttons for both providers

**Database:**
- `backend/db/schema.sql` - Updated schema with provider support
- Added `outlook_id`, `provider` columns to users table

**Dependencies:**
- `@azure/msal-node` - Microsoft Authentication Library
- `@microsoft/microsoft-graph-client` - Microsoft Graph API client

## Setup Instructions

### 1. Register Azure Application

To use Outlook Calendar integration, you need to register an application in Azure AD:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations** → **New registration**
3. Configure the application:
   - **Name**: AI Calendar Assistant (or your preferred name)
   - **Supported account types**: Accounts in any organizational directory and personal Microsoft accounts
   - **Redirect URI**:
     - Platform: Web
     - URI: `http://localhost:3001/api/auth/outlook/callback` (for development)
4. After registration, note the **Application (client) ID**
5. Go to **Certificates & secrets** → **New client secret**
   - Add a description and expiration period
   - **Copy the secret value** (you won't be able to see it again!)
6. Go to **API permissions**:
   - Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
   - Add these permissions:
     - `Calendars.ReadWrite`
     - `User.Read`
     - `offline_access`
   - Click **Grant admin consent** (if available)

### 2. Configure Environment Variables

Update your `.env` file with the Microsoft/Outlook credentials:

```bash
# Microsoft/Outlook OAuth Credentials
MICROSOFT_CLIENT_ID=your-application-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret-value
MICROSOFT_REDIRECT_URI=http://localhost:3001/api/auth/outlook/callback
MICROSOFT_TENANT_ID=common

# Also update Google redirect URI to match new path
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
```

**Note:**
- Use `MICROSOFT_TENANT_ID=common` to support both work/school and personal Microsoft accounts
- Use your specific tenant ID to restrict to your organization only

### 3. Run Database Migration

Apply the database migration to add Outlook support:

```bash
cd backend
psql -U your_username -d ai_planner -f db/migrations/001_add_outlook_support.sql
```

Or using the connection string:
```bash
psql $DATABASE_URL -f db/migrations/001_add_outlook_support.sql
```

### 4. Install Dependencies

```bash
cd backend
npm install
```

### 5. Start the Application

```bash
# Backend
cd backend
npm start

# Frontend (in another terminal)
cd frontend
npm run dev
```

## Usage

### Logging In

1. Navigate to the application
2. Choose between **Connect Google Calendar** or **Connect Outlook Calendar**
3. Complete the OAuth flow for your chosen provider
4. Start managing your calendar with AI!

### Switching Providers

Currently, each user account is tied to one provider. To switch providers:
1. Log out from the current session
2. Log in with the other provider

*Note: Future versions may support linking multiple calendar providers to one account.*

## API Endpoints

### Authentication Routes

```
GET  /api/auth/google              - Initiate Google OAuth flow
GET  /api/auth/google/callback     - Google OAuth callback
GET  /api/auth/outlook             - Initiate Outlook OAuth flow
GET  /api/auth/outlook/callback    - Outlook OAuth callback
GET  /api/auth/status              - Check authentication status (includes provider)
POST /api/auth/logout              - Logout
```

### Calendar Routes

All calendar routes remain the same and work with both providers:

```
GET    /api/calendar/list              - List all calendars
GET    /api/calendar/events            - Get events
POST   /api/calendar/events            - Create event
PATCH  /api/calendar/events/:eventId   - Update event
DELETE /api/calendar/events/:eventId   - Delete event
```

The middleware automatically determines which provider to use based on the authenticated user.

## Database Schema Changes

### Users Table

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  google_id VARCHAR(255) UNIQUE,      -- Nullable now
  outlook_id VARCHAR(255) UNIQUE,     -- NEW
  provider VARCHAR(50) NOT NULL DEFAULT 'google',  -- NEW
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT provider_id_check CHECK (
    (provider = 'google' AND google_id IS NOT NULL) OR
    (provider = 'outlook' AND outlook_id IS NOT NULL)
  )
);
```

### Indexes

```sql
CREATE INDEX IDX_users_outlook_id ON users(outlook_id);
CREATE INDEX IDX_users_provider ON users(provider);
```

## Event Format Translation

The Outlook provider automatically translates between Google Calendar and Microsoft Graph API event formats:

### Google → Outlook

```javascript
Google Format:
{
  summary: "Meeting",
  description: "Description",
  start: { dateTime: "2024-01-01T10:00:00Z", timeZone: "UTC" },
  end: { dateTime: "2024-01-01T11:00:00Z", timeZone: "UTC" },
  location: "Office",
  attendees: [{ email: "user@example.com" }]
}

↓ Translated to ↓

Outlook Format:
{
  subject: "Meeting",
  body: { contentType: "HTML", content: "Description" },
  start: { dateTime: "2024-01-01T10:00:00Z", timeZone: "UTC" },
  end: { dateTime: "2024-01-01T11:00:00Z", timeZone: "UTC" },
  location: { displayName: "Office" },
  attendees: [{ emailAddress: { address: "user@example.com" }, type: "required" }]
}
```

### Outlook → Google

The reverse translation happens automatically when fetching events from Outlook, ensuring the frontend receives a consistent event format regardless of the provider.

## Testing

### Test Google Calendar Integration

1. Log in with Google
2. Verify calendars are listed
3. Create, update, and delete events
4. Use AI chat to manage calendar

### Test Outlook Calendar Integration

1. Log out if already logged in
2. Log in with Outlook
3. Verify calendars are listed
4. Create, update, and delete events
5. Use AI chat to manage calendar

## Troubleshooting

### Outlook Authentication Fails

**Problem:** "Authentication failed" error when logging in with Outlook

**Solutions:**
- Verify `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` are correct
- Check that the redirect URI in Azure matches exactly: `http://localhost:3001/api/auth/outlook/callback`
- Ensure API permissions are granted in Azure AD
- Check the backend logs for detailed error messages

### Events Not Showing

**Problem:** Calendar appears empty after logging in with Outlook

**Solutions:**
- Verify the Microsoft account has events in the calendar
- Check browser console for API errors
- Ensure `Calendars.ReadWrite` permission is granted in Azure
- Verify the access token is valid (check backend logs)

### Database Errors

**Problem:** Database constraint errors when logging in

**Solutions:**
- Ensure the migration script has been run
- Verify the `provider` column exists in the users table
- Check that existing users have `provider='google'` set

## Production Deployment

### Environment Variables

Update your production environment variables:

```bash
# Update redirect URIs to production URLs
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
MICROSOFT_REDIRECT_URI=https://yourdomain.com/api/auth/outlook/callback

# Other production variables
FRONTEND_URL=https://yourdomain.com
```

### Azure App Registration

Update redirect URIs in Azure App Registration:
1. Go to your app in Azure Portal
2. Navigate to **Authentication**
3. Add production redirect URI: `https://yourdomain.com/api/auth/outlook/callback`
4. Save changes

### Security Considerations

- Store client secrets securely (use environment variables or secret management service)
- Use HTTPS in production
- Regularly rotate client secrets
- Monitor API usage and rate limits
- Implement proper error handling and logging

## Future Enhancements

Possible improvements for the future:

- [ ] Support for multiple calendar providers per user
- [ ] Calendar sync between providers
- [ ] Support for additional providers (Apple Calendar, CalDAV)
- [ ] Provider-specific features (Teams meetings for Outlook, Meet for Google)
- [ ] Improved error messages with provider-specific guidance
- [ ] Account linking (same email, multiple providers)

## License

This integration maintains the same license as the main project.
