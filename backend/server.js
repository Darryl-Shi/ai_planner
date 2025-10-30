import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { google } from 'googleapis';
import OpenAI from 'openai';
import crypto from 'crypto';
import pool, { findOrCreateUser, getUserSettings, updateUserSettings, deleteUserApiKey } from './db/connection.js';
import { encryptApiKey, decryptApiKey, validateEncryptionKey } from './utils/encryption.js';

dotenv.config();

// Validate encryption key on startup
if (!validateEncryptionKey()) {
  console.error('ERROR: Invalid or missing ENCRYPTION_KEY in environment variables');
  console.error('Generate a key with: openssl rand -hex 32');
  process.exit(1);
}

const app = express();
// If running behind a reverse proxy (nginx/traefik), trust it so secure cookies work
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
// Disable ETag to avoid 304 on dynamic JSON endpoints like /api/auth/google
app.set('etag', false);

// Setup PostgreSQL session store
const PgSession = connectPgSimple(session);
app.use(session({
  store: new PgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    // Use secure cookies automatically when connection is HTTPS (behind proxy)
    secure: 'auto',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Note: OpenRouter client is now created per-user in the chat endpoint
// using each user's personal API key from the database

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/callback'
);

// Google OAuth scopes
// Include userinfo scopes since we call oauth2.userinfo.get() to fetch profile
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid'
];

// ==================== AUTH ROUTES ====================

// Initiate Google OAuth
app.get('/api/auth/google', (req, res) => {
  // Create CSRF state and store in session
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    include_granted_scopes: true,
    state
  });

  // Prevent caching of this dynamic response
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.json({ authUrl });
});

// OAuth callback
app.get('/api/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  // Verify CSRF state if present
  if (req.session.oauthState && state !== req.session.oauthState) {
    console.error('OAuth callback state mismatch');
    return res.status(400).json({ error: 'Invalid state parameter' });
  }
  // Clear state
  req.session.oauthState = undefined;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens) {
      console.error('OAuth callback: getToken returned no tokens');
      return res.status(500).json({ error: 'Authentication failed' });
    }
    console.log('OAuth tokens received', {
      hasAccessToken: !!tokens.access_token,
      hasIdToken: !!tokens.id_token,
      hasRefreshToken: !!tokens.refresh_token,
      scope: tokens.scope
    });
    oauth2Client.setCredentials(tokens);

    // Try to obtain profile from ID token (preferred)
    let googleId;
    let email;
    let name;

    if (tokens.id_token) {
      try {
        const ticket = await oauth2Client.verifyIdToken({
          idToken: tokens.id_token,
          audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        googleId = payload?.sub;
        email = payload?.email;
        name = payload?.name || payload?.given_name || '';
      } catch (verifyErr) {
        console.warn('Failed to verify ID token, falling back to userinfo:', verifyErr?.message);
      }
    }

    // Fallback to userinfo endpoint if needed
    if (!googleId || !email) {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      googleId = userInfo.data?.id;
      email = userInfo.data?.email;
      name = userInfo.data?.name;
    }

    if (!googleId || !email) {
      console.error('Failed to retrieve user identity from Google');
      return res.status(500).json({ error: 'Authentication failed' });
    }

    // Find or create user in database
    const user = await findOrCreateUser(googleId, email, name);
    console.log('User authenticated:', user.email);

    // Store tokens and user ID in session
    req.session.tokens = tokens;
    req.session.userId = user.id;

    // Redirect to frontend
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
  } catch (error) {
    // Log detailed error info for diagnosis
    const details = {
      message: error?.message,
      code: error?.code,
      responseData: error?.response?.data,
    };
    console.error('Error during OAuth callback:', details);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
  const isAuthenticated = !!req.session.tokens;
  res.json({ isAuthenticated });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ==================== MIDDLEWARE ====================

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session.tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  oauth2Client.setCredentials(req.session.tokens);
  next();
};

// ==================== USER SETTINGS ROUTES ====================

// Get user settings
app.get('/api/user/settings', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not found in session' });
    }

    const settings = await getUserSettings(userId);

    if (!settings) {
      return res.json({
        hasApiKey: false,
        model: null
      });
    }

    // Return masked API key status and model preference
    res.json({
      hasApiKey: !!settings.openrouter_api_key_encrypted,
      model: settings.openrouter_model || null,
      // Don't send the actual API key to the frontend
      apiKeyPreview: settings.openrouter_api_key_encrypted
        ? `sk-...${settings.openrouter_api_key_encrypted.slice(-4)}`
        : null
    });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ error: 'Failed to fetch user settings' });
  }
});

// Save user settings
app.post('/api/user/settings', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { apiKey, model } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not found in session' });
    }

    // Validate inputs
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ error: 'API key is required' });
    }

    if (!model || !model.trim()) {
      return res.status(400).json({ error: 'Model name is required' });
    }

    // Encrypt the API key
    const { encrypted, iv } = encryptApiKey(apiKey.trim());

    // Save to database
    await updateUserSettings(userId, encrypted, model.trim(), iv);

    res.json({
      success: true,
      message: 'Settings saved successfully'
    });
  } catch (error) {
    console.error('Error saving user settings:', error);
    res.status(500).json({ error: 'Failed to save user settings' });
  }
});

// Delete user API key
app.delete('/api/user/settings/api-key', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not found in session' });
    }

    await deleteUserApiKey(userId);

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// ==================== CALENDAR ROUTES ====================

// Get list of calendars
app.get('/api/calendar/list', requireAuth, async (req, res) => {
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.calendarList.list();

    res.json({ calendars: response.data.items });
  } catch (error) {
    console.error('Error fetching calendars:', error);
    res.status(500).json({ error: 'Failed to fetch calendars' });
  }
});

// Get calendar events
app.get('/api/calendar/events', requireAuth, async (req, res) => {
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const { timeMin, timeMax, maxResults, calendarId } = req.query;

    const response = await calendar.events.list({
      calendarId: calendarId || 'primary',
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax,
      maxResults: parseInt(maxResults) || 100,
      singleEvents: true,
      orderBy: 'startTime'
    });

    res.json({ events: response.data.items });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Create calendar event
app.post('/api/calendar/events', requireAuth, async (req, res) => {
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const eventData = req.body;

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventData
    });

    res.json({ event: response.data });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update calendar event
app.patch('/api/calendar/events/:eventId', requireAuth, async (req, res) => {
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const { eventId } = req.params;
    const eventData = req.body;

    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: eventData
    });

    res.json({ event: response.data });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete calendar event
app.delete('/api/calendar/events/:eventId', requireAuth, async (req, res) => {
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const { eventId } = req.params;

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ==================== AI CHAT ROUTE ====================

// Define calendar tools for the LLM
const calendarTools = [
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description: 'Create one or more new calendar events',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                summary: { type: 'string', description: 'Event title' },
                description: { type: 'string', description: 'Event description' },
                start: {
                  type: 'object',
                  properties: {
                    dateTime: { type: 'string', description: 'Start time in ISO 8601 format' },
                    timeZone: { type: 'string', description: 'IANA timezone' }
                  },
                  required: ['dateTime', 'timeZone']
                },
                end: {
                  type: 'object',
                  properties: {
                    dateTime: { type: 'string', description: 'End time in ISO 8601 format' },
                    timeZone: { type: 'string', description: 'IANA timezone' }
                  },
                  required: ['dateTime', 'timeZone']
                }
              },
              required: ['summary', 'start', 'end']
            }
          }
        },
        required: ['events']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_calendar_event',
      description: 'Update existing calendar events',
      parameters: {
        type: 'object',
        properties: {
          updates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                eventId: { type: 'string', description: 'The Google Calendar event ID to update' },
                summary: { type: 'string', description: 'New event title' },
                description: { type: 'string', description: 'New event description' },
                start: {
                  type: 'object',
                  properties: {
                    dateTime: { type: 'string', description: 'New start time in ISO 8601 format' },
                    timeZone: { type: 'string', description: 'IANA timezone' }
                  }
                },
                end: {
                  type: 'object',
                  properties: {
                    dateTime: { type: 'string', description: 'New end time in ISO 8601 format' },
                    timeZone: { type: 'string', description: 'IANA timezone' }
                  }
                }
              },
              required: ['eventId']
            }
          }
        },
        required: ['updates']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_calendar_events',
      description: 'Delete one or more calendar events',
      parameters: {
        type: 'object',
        properties: {
          eventIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of Google Calendar event IDs to delete'
          }
        },
        required: ['eventIds']
      }
    }
  }
];

app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { messages, events, timeZone } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not found in session' });
    }

    // Get user's OpenRouter settings
    const settings = await getUserSettings(userId);

    // Check if user has configured their API key
    if (!settings || !settings.openrouter_api_key_encrypted) {
      return res.status(403).json({
        error: 'OpenRouter API key not configured',
        message: 'Please configure your OpenRouter API key in Settings before using the chat feature.'
      });
    }

    // Decrypt the user's API key
    let userApiKey;
    try {
      userApiKey = decryptApiKey(settings.openrouter_api_key_encrypted, settings.encryption_iv);
    } catch (error) {
      console.error('Failed to decrypt user API key:', error);
      return res.status(500).json({
        error: 'Failed to decrypt API key',
        message: 'Please re-configure your API key in Settings.'
      });
    }

    // Get user's preferred model (fallback to Claude 3.5 Sonnet)
    const userModel = settings.openrouter_model || 'anthropic/claude-3.5-sonnet';

    // Create OpenRouter client with user's API key
    const userOpenAI = new OpenAI({
      apiKey: userApiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      timeout: 30000,
      maxRetries: 2
    });

    // Use user's timezone from request, fallback to event timezone or UTC
    const userTimeZone = timeZone || events?.[0]?.start?.timeZone || 'UTC';

    // Create system prompt with calendar context
    const systemPrompt = {
      role: 'system',
      content: `You are a helpful AI calendar assistant. You help users manage their Google Calendar events.

Current calendar events:
${events && events.length > 0 ? events.map(e =>
  `- [ID: ${e.id}] ${e.summary} (${e.start?.dateTime || e.start?.date} to ${e.end?.dateTime || e.end?.date})`
).join('\n') : 'No events currently scheduled.'}

You can:
1. Discuss event details with the user (duration, timing, etc.) before creating events
2. See all existing events to suggest optimal times and avoid conflicts
3. Create multiple events in a single conversation
4. Edit or delete existing events using their IDs
5. Provide scheduling recommendations based on their calendar

IMPORTANT DATE HANDLING RULES:
- When the user says relative dates like "this Friday", "next Tuesday", "tomorrow", "this weekend", etc., you MUST confidently interpret the date without asking for confirmation
- Use the current date/time provided below to calculate the exact date for relative references
- "this Friday" = the upcoming Friday from today (if today is Friday, it means today)
- "next Friday" = the Friday of next week
- "this weekend" = the upcoming Saturday/Sunday
- "tomorrow" = the next day from current date
- Only ask for clarification if the request is genuinely ambiguous (e.g., "sometime next week" without specifying a day) or if time/duration is not specified

When creating, updating, or deleting events, use the provided tools. Always use the actual event IDs shown in [ID: ...] brackets.

TIMEZONE REQUIREMENTS:
- You MUST use the user's timezone: ${userTimeZone}
- All times mentioned by the user are in ${userTimeZone} timezone unless they explicitly specify otherwise
- Always include the timezone in your tool calls

Current date and time: ${new Date().toISOString()}
User's timezone: ${userTimeZone}
Day of week today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: userTimeZone })}`
    };

    // Make request to OpenRouter
    console.log('Sending request to OpenRouter...');
    console.log('User ID:', userId);
    console.log('Model:', userModel);
    console.log('Message count:', messages.length);

    const completion = await userOpenAI.chat.completions.create({
      model: userModel,
      messages: [systemPrompt, ...messages],
      tools: calendarTools,
      tool_choice: 'auto'
    });

    console.log('Received response from OpenRouter');
    let assistantMessage = completion.choices[0].message;

    // Handle tool calls if present
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log('Processing tool calls:', assistantMessage.tool_calls.length);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const toolMessages = [];

      // Add the assistant's message with tool calls to conversation
      toolMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`Executing tool: ${functionName}`, args);

        let toolResult;
        try {
          if (functionName === 'create_calendar_event') {
            const createdEvents = [];
            for (const event of args.events) {
              const response = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: event
              });
              createdEvents.push(response.data);
            }
            toolResult = JSON.stringify({ success: true, created: createdEvents.length });
          } else if (functionName === 'update_calendar_event') {
            const updatedEvents = [];
            for (const update of args.updates) {
              const { eventId, ...eventData } = update;
              const response = await calendar.events.patch({
                calendarId: 'primary',
                eventId: eventId,
                requestBody: eventData
              });
              updatedEvents.push(response.data);
            }
            toolResult = JSON.stringify({ success: true, updated: updatedEvents.length });
          } else if (functionName === 'delete_calendar_events') {
            for (const eventId of args.eventIds) {
              await calendar.events.delete({
                calendarId: 'primary',
                eventId: eventId
              });
            }
            toolResult = JSON.stringify({ success: true, deleted: args.eventIds.length });
          }
        } catch (error) {
          console.error(`Error executing ${functionName}:`, error);
          toolResult = JSON.stringify({ success: false, error: error.message });
        }

        // Add tool result message
        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult
        });
      }

      // Send tool results back to LLM to get final response
      console.log('Sending tool results back to LLM...');
      const followUpCompletion = await userOpenAI.chat.completions.create({
        model: userModel,
        messages: [systemPrompt, ...messages, ...toolMessages]
      });

      console.log('Received final response from OpenRouter');
      assistantMessage = followUpCompletion.choices[0].message;

      res.json({
        message: assistantMessage,
        toolCallsExecuted: true
      });
    } else {
      res.json({ message: assistantMessage });
    }
  } catch (error) {
    console.error('Error in chat:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to process chat request: ' + error.message });
  }
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Lightweight runtime health/config endpoint (no secrets)
app.get('/api/health/runtime', (req, res) => {
  res.json({
    frontendUrl: process.env.FRONTEND_URL || null,
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || null,
    nodeEnv: process.env.NODE_ENV || null,
    trustProxy: app.get('trust proxy') || false,
    time: new Date().toISOString()
  });
});
