# Docker Setup Guide

This guide will help you run the AI Calendar Planner using Docker Compose, which provides a complete containerized environment with PostgreSQL, backend, and frontend services.

## Prerequisites

- Docker Desktop (version 20.10+)
- Docker Compose (version 2.0+)
- Git (to clone the repository)

### Install Docker

**macOS:**
```bash
brew install --cask docker
# Or download from https://www.docker.com/products/docker-desktop
```

**Linux:**
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect
```

**Windows:**
Download and install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)

## Quick Start

### 1. Configure Environment Variables

Create a local environment file:

```bash
cp .env.docker .env.docker.local
```

Edit `.env.docker.local` with your values:

```bash
# Generate encryption key
openssl rand -hex 32

# Generate session secret
openssl rand -hex 32
```

Paste the generated values into `.env.docker.local`:

```bash
POSTGRES_PASSWORD=your_secure_postgres_password
ENCRYPTION_KEY=<paste first generated key>
SESSION_SECRET=<paste second generated key>
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/callback
```

### 2. Start the Application

```bash
# Start all services
docker-compose --env-file .env.docker.local up

# Or start in detached mode (background)
docker-compose --env-file .env.docker.local up -d
```

### 3. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **PostgreSQL:** localhost:5432

### 4. Initialize Database (First Time Only)

The database schema is automatically initialized when PostgreSQL starts for the first time. The `schema.sql` file is mounted as an init script.

To verify the database was initialized:

```bash
docker-compose exec backend node scripts/init-db.js
```

You should see:
```
✅ Database connection successful
✅ Database tables created successfully
```

## Docker Services

The stack consists of three services:

### 1. PostgreSQL Database (`postgres`)
- **Image:** postgres:15-alpine
- **Port:** 5432
- **Volume:** `postgres_data` (persistent storage)
- **Auto-initialization:** Runs `schema.sql` on first start

### 2. Backend API (`backend`)
- **Build:** From `./backend/Dockerfile`
- **Port:** 3001
- **Dependencies:** postgres (waits for health check)
- **Hot Reload:** Source code mounted for development

### 3. Frontend (`frontend`)
- **Build:** From `./frontend/Dockerfile`
- **Port:** 3000
- **Dependencies:** backend
- **Hot Reload:** Source code mounted for development

## Common Commands

### Start Services
```bash
# Start all services (foreground)
docker-compose --env-file .env.docker.local up

# Start in background
docker-compose --env-file .env.docker.local up -d

# Start specific service
docker-compose --env-file .env.docker.local up backend

# Rebuild and start (after code changes to Dockerfile)
docker-compose --env-file .env.docker.local up --build
```

### Stop Services
```bash
# Stop all services (keeps containers)
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes (DELETES DATABASE!)
docker-compose down -v
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f postgres

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Execute Commands
```bash
# Access backend shell
docker-compose exec backend sh

# Access PostgreSQL shell
docker-compose exec postgres psql -U ai_planner -d ai_planner

# Run database initialization
docker-compose exec backend node scripts/init-db.js

# Install new npm packages
docker-compose exec backend npm install <package-name>
docker-compose exec frontend npm install <package-name>
```

### Database Operations
```bash
# Access PostgreSQL CLI
docker-compose exec postgres psql -U ai_planner -d ai_planner

# Backup database
docker-compose exec postgres pg_dump -U ai_planner ai_planner > backup.sql

# Restore database
cat backup.sql | docker-compose exec -T postgres psql -U ai_planner -d ai_planner

# View database tables
docker-compose exec postgres psql -U ai_planner -d ai_planner -c "\dt"

# Query users
docker-compose exec postgres psql -U ai_planner -d ai_planner -c "SELECT * FROM users;"
```

### Restart Services
```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Clean Up
```bash
# Remove stopped containers
docker-compose rm

# Remove all containers, networks, and volumes
docker-compose down -v

# Remove unused Docker images
docker image prune -a

# Full cleanup (removes all unused Docker resources)
docker system prune -a --volumes
```

## Development Workflow

### Hot Reload (Development)

Both frontend and backend support hot reload:

1. **Backend:** Nodemon watches for file changes
2. **Frontend:** Vite dev server watches for file changes

Simply edit your code, and changes will be reflected automatically!

### Adding npm Packages

```bash
# Backend
docker-compose exec backend npm install express-rate-limit
docker-compose restart backend

# Frontend
docker-compose exec frontend npm install axios
docker-compose restart frontend
```

### Debugging

**Backend:**
```bash
# View real-time logs
docker-compose logs -f backend

# Access backend shell to inspect files
docker-compose exec backend sh
ls -la
cat .env
```

**Database:**
```bash
# Check if database is healthy
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres

# Connect to database
docker-compose exec postgres psql -U ai_planner -d ai_planner

# List all tables
\dt

# Describe a table
\d users

# Query data
SELECT * FROM users;
```

## Production Deployment with Docker

### 1. Create Production Dockerfile

For production, create optimized Dockerfiles:

**backend/Dockerfile.prod:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

**frontend/Dockerfile.prod:**
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 2. Create Production Compose File

**docker-compose.prod.yml:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: ai_planner
      POSTGRES_USER: ai_planner
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - ai-planner-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://ai_planner:${POSTGRES_PASSWORD}@postgres:5432/ai_planner
      SESSION_SECRET: ${SESSION_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI}
      FRONTEND_URL: ${FRONTEND_URL}
    depends_on:
      - postgres
    networks:
      - ai-planner-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - ai-planner-network

volumes:
  postgres_data:

networks:
  ai-planner-network:
```

### 3. Deploy to Server

```bash
# Copy files to server
scp -r . user@server:/opt/ai-planner

# SSH into server
ssh user@server

# Navigate to app directory
cd /opt/ai-planner

# Create production env file
nano .env.prod

# Start services
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 3001
lsof -i :3001

# Kill the process or change port in docker-compose.yml
ports:
  - "3002:3001"  # Host:Container
```

### Container Won't Start

```bash
# Check container status
docker-compose ps

# View detailed logs
docker-compose logs backend

# Rebuild container
docker-compose build backend
docker-compose up backend
```

### Database Connection Failed

```bash
# Check if PostgreSQL is healthy
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres

# Verify DATABASE_URL is correct
docker-compose exec backend printenv | grep DATABASE
```

### Encryption Key Error

```bash
# Generate new key
openssl rand -hex 32

# Update .env.docker.local
# Restart backend
docker-compose restart backend
```

### Volume Permission Issues (Linux)

```bash
# Fix ownership
sudo chown -R $USER:$USER postgres_data

# Or run with sudo
sudo docker-compose up
```

### Reset Everything

```bash
# Stop and remove everything
docker-compose down -v

# Remove images
docker-compose rm -f
docker rmi $(docker images -q ai-planner*)

# Start fresh
docker-compose --env-file .env.docker.local up --build
```

## Performance Tuning

### Increase PostgreSQL Performance

Edit `docker-compose.yml`:

```yaml
postgres:
  # ... existing config ...
  command: postgres -c shared_buffers=256MB -c max_connections=200
```

### Limit Container Resources

```yaml
backend:
  # ... existing config ...
  deploy:
    resources:
      limits:
        cpus: '1'
        memory: 1G
      reservations:
        cpus: '0.5'
        memory: 512M
```

## Backup & Restore

### Automated Backups

Create a backup script:

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR

docker-compose exec -T postgres pg_dump -U ai_planner ai_planner > $BACKUP_DIR/backup_$DATE.sql

# Keep only last 7 backups
ls -t $BACKUP_DIR/backup_*.sql | tail -n +8 | xargs rm -f

echo "Backup completed: backup_$DATE.sql"
```

Schedule with cron:
```bash
# Run daily at 2 AM
0 2 * * * /path/to/backup.sh
```

### Restore from Backup

```bash
cat backups/backup_20250130_140000.sql | docker-compose exec -T postgres psql -U ai_planner -d ai_planner
```

## Security Best Practices

1. **Never commit `.env.docker.local`** - Add to `.gitignore`
2. **Use strong passwords** - Generate with `openssl rand -base64 32`
3. **Rotate secrets regularly** - Update `ENCRYPTION_KEY` and `SESSION_SECRET`
4. **Limit exposed ports** - Remove port mappings in production (use reverse proxy)
5. **Update images regularly** - `docker-compose pull && docker-compose up -d`
6. **Use Docker secrets** - For production deployments
7. **Enable PostgreSQL SSL** - Configure SSL certificates

## Next Steps

- Set up reverse proxy (nginx) for HTTPS
- Configure Docker secrets for production
- Set up automated backups
- Monitor container health
- Configure log aggregation
- Set up CI/CD pipeline

## Support

If you encounter issues:

1. Check logs: `docker-compose logs -f`
2. Verify environment variables: `docker-compose config`
3. Test database connection: `docker-compose exec backend node scripts/init-db.js`
4. Check service health: `docker-compose ps`

For more help, see:
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
