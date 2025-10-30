# AI Calendar Planner

A full-stack AI-powered calendar assistant that helps users manage their Google Calendar through natural language conversations. Users bring their own OpenRouter API keys for secure, personalized AI interactions.

## Features

- 🗓️ **Google Calendar Integration** - Full read/write access to your calendar
- 🤖 **AI Assistant** - Natural language calendar management
- 🔐 **User-Specific API Keys** - Each user provides their own OpenRouter key
- 🔒 **Encrypted Storage** - AES-256-CBC encryption for API keys at rest
- 🎨 **Custom Models** - Users can choose their preferred AI model
- 💾 **Persistent Sessions** - PostgreSQL-backed session management
- 🐳 **Docker Support** - Complete containerized environment
- 🌐 **Production Ready** - Full deployment guides included

## Tech Stack

**Frontend:**
- React 18 + Vite
- CSS for styling
- Lucide React icons

**Backend:**
- Node.js + Express
- PostgreSQL (user data & sessions)
- Google OAuth 2.0
- OpenRouter API integration
- AES-256-CBC encryption

**Infrastructure:**
- Docker & Docker Compose
- PostgreSQL 15

## Quick Start

### Option 1: Docker (Recommended)

```bash
# 1. Run the quick start script
./start-docker.sh

# 2. Follow the prompts to configure Google OAuth
# 3. Access the app at http://localhost:3000
```

See [DOCKER.md](./DOCKER.md) for detailed Docker instructions.

### Option 2: Manual Setup

#### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Google OAuth credentials (users bring their own OpenRouter keys)

## Setup Instructions

### 1. Google Calendar API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Calendar API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3001/api/auth/callback` (for development)
   - Save your Client ID and Client Secret

### 2. Setup PostgreSQL

```bash
# Option A: Local PostgreSQL
brew install postgresql  # macOS
brew services start postgresql
createdb ai_planner

# Option B: Docker
docker run -d \
  --name postgres \
  -e POSTGRES_DB=ai_planner \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:15

# Option C: Cloud (Supabase, Neon, etc.)
# Follow provider instructions and get connection string
```

### 3. Backend Setup

```bash
cd backend
npm install

# Create environment file
cp .env.example .env

# Generate encryption key
openssl rand -hex 32

# Edit .env and set:
# - DATABASE_URL=postgresql://user:pass@localhost:5432/ai_planner
# - ENCRYPTION_KEY=<paste generated key>
# - SESSION_SECRET=<generate another key>
# - GOOGLE_CLIENT_ID=<your Google OAuth ID>
# - GOOGLE_CLIENT_SECRET=<your Google OAuth secret>
```

### 4. Initialize Database

```bash
cd backend
node scripts/init-db.js
```

You should see:
```
✅ Database connection successful
✅ Database tables created successfully
```

### 5. Frontend Setup

```bash
cd frontend
npm install
```

## Running the Application

### Terminal 1 - Backend
```bash
cd backend
npm run dev
```
The backend will start on `http://localhost:3001`

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```
The frontend will start on `http://localhost:5173`

## User Guide

### First Time Setup

1. **Connect Google Calendar**
   - Click "Connect Google Calendar"
   - Authorize the app to access your calendar

2. **Configure OpenRouter**
   - Click "Settings" in the top right
   - Get an API key from [openrouter.ai/keys](https://openrouter.ai/keys)
   - Enter your API key and preferred model
   - Click "Save Settings"

3. **Start Using the Assistant**
   - Type natural language requests
   - Examples:
     - "Schedule a meeting with John tomorrow at 2pm"
     - "What do I have scheduled this week?"
     - "Move my 3pm meeting to 4pm"
     - "Cancel all meetings on Friday"

### Supported Models

Users can choose any model from [OpenRouter](https://openrouter.ai/models):

- `anthropic/claude-3.5-sonnet` (recommended)
- `openai/gpt-4-turbo`
- `meta-llama/llama-3-70b-instruct`
- `google/gemini-pro`
- And many more!

## Example Conversations

**Creating an Event:**
```
You: I need to schedule a project review meeting
AI: Sure! When would you like to schedule the project review meeting?
You: Tomorrow afternoon
AI: I see you have meetings until 2pm tomorrow. Would 3pm work for you? How long should it be?
You: 3pm works! Make it 90 minutes
AI: Perfect! I've created "Project Review Meeting" for tomorrow at 3:00 PM - 4:30 PM.
```

**Checking Availability:**
```
You: When am I free tomorrow?
AI: Tomorrow you have:
- Team standup at 9:00 AM
- Client call at 11:00 AM
- Lunch meeting at 12:30 PM

You're free from 10:00 AM - 11:00 AM and after 2:00 PM.
```

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `ENCRYPTION_KEY` - 64-char hex key (generate: `openssl rand -hex 32`)
- `SESSION_SECRET` - Random secret for sessions
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - OAuth callback URL
- `FRONTEND_URL` - Frontend URL for CORS

### Optional
- `PORT` - Backend port (default: 3001)
- `NODE_ENV` - Environment (development/production)

## Project Structure

```
ai_planner_claude/
├── backend/
│   ├── db/
│   │   ├── connection.js      # Database queries
│   │   └── schema.sql         # Database schema
│   ├── scripts/
│   │   └── init-db.js        # Database initialization
│   ├── utils/
│   │   └── encryption.js     # API key encryption
│   ├── server.js             # Express server
│   ├── Dockerfile            # Backend container
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Settings.jsx       # Settings modal
│   │   │   ├── ChatSidebar.jsx    # AI chat interface
│   │   │   ├── CalendarGrid.jsx   # Calendar view
│   │   │   └── ...
│   │   ├── App.jsx           # Main app component
│   │   └── main.jsx
│   ├── Dockerfile            # Frontend dev container
│   ├── Dockerfile.prod       # Frontend prod container
│   ├── nginx.conf            # Nginx config for prod
│   └── package.json
├── docker-compose.yml        # Development compose
├── docker-compose.prod.yml   # Production compose
├── start-docker.sh          # Quick start script
├── DOCKER.md               # Docker documentation
├── DEPLOYMENT.md           # Deployment guide
└── README.md              # This file
```

## API Endpoints

### Authentication
- `GET /api/auth/google` - Start OAuth flow
- `GET /api/auth/callback` - OAuth callback
- `GET /api/auth/status` - Check auth status
- `POST /api/auth/logout` - Logout

### User Settings
- `GET /api/user/settings` - Get user settings
- `POST /api/user/settings` - Save API key & model
- `DELETE /api/user/settings/api-key` - Delete API key

### Calendar
- `GET /api/calendar/list` - List calendars
- `GET /api/calendar/events` - Get events
- `POST /api/calendar/events` - Create event
- `PATCH /api/calendar/events/:id` - Update event
- `DELETE /api/calendar/events/:id` - Delete event

### AI Chat
- `POST /api/chat` - Send message to AI

## Security

- ✅ API keys encrypted with AES-256-CBC
- ✅ Unique IV per encrypted value
- ✅ Secure session management
- ✅ CORS protection
- ✅ Environment variable validation
- ✅ No API keys in logs
- ✅ SQL injection protection (parameterized queries)

## Deployment

### Docker Production Deployment (with Reverse Proxy)

**Recommended**: Production deployment works with a reverse proxy manager like Nginx Proxy Manager or Traefik.

```bash
# 1. Create proxy network
docker network create proxy

# 2. Create production environment file
cp .env.prod.example .env.prod
# Edit with your domain and production values

# 3. Start the stack
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 4. Configure your reverse proxy
# Point calendar.yourdomain.com → ai-planner-frontend-prod:80
```

**Complete Guide**: See [REVERSE-PROXY.md](./REVERSE-PROXY.md) for:
- Nginx Proxy Manager setup
- Traefik configuration
- Caddy setup
- SSL/HTTPS configuration
- Troubleshooting

### Cloud Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions on deploying to:
- Railway
- Render
- Heroku
- Vercel (frontend)
- Netlify (frontend)

## Development

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Run dev server (with nodemon)
npm run dev

# Run production
npm start

# Initialize database
node scripts/init-db.js
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Database Operations

```bash
# Connect to database
psql postgresql://user:pass@localhost:5432/ai_planner

# View tables
\dt

# Query users
SELECT * FROM users;

# Query settings
SELECT u.email, s.openrouter_model
FROM users u
JOIN user_settings s ON u.id = s.user_id;
```

## Troubleshooting

### "ENCRYPTION_KEY must be 32 bytes"
Generate a proper key: `openssl rand -hex 32`

### Database connection failed
- Verify PostgreSQL is running
- Check `DATABASE_URL` format
- Test connection: `psql $DATABASE_URL`

### Session not persisting
- Verify PostgreSQL session store is configured
- Check `SESSION_SECRET` is set
- For HTTPS, ensure cookie `secure` flag is set

### API key not working
- Verify key is valid at [openrouter.ai](https://openrouter.ai)
- Check you have credits
- Try a different model

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT

## Support

For issues or questions:
1. Check [DOCKER.md](./DOCKER.md) for Docker issues
2. Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment issues
3. Review server logs
4. Open an issue on GitHub

## Acknowledgments

- Built with [OpenRouter](https://openrouter.ai) for AI model access
- Uses [Google Calendar API](https://developers.google.com/calendar)
- Powered by [Anthropic Claude](https://www.anthropic.com) and other LLMs
