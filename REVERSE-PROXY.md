# Reverse Proxy Setup Guide

This guide covers deploying the AI Calendar Planner behind a reverse proxy manager like Nginx Proxy Manager or Traefik.

## Overview

The production Docker Compose stack is designed to work with a system-level reverse proxy:

- **Frontend**: Exposes port 80 internally (not published to host)
- **Backend**: Accessible only through frontend's nginx proxy
- **Database**: Only accessible within Docker network
- **Proxy Network**: External network shared with your reverse proxy

## Architecture

```
Internet
    ↓
[Your Reverse Proxy] (port 80/443)
    ↓
[proxy network]
    ↓
[AI Planner Frontend] (internal port 80)
    ↓ (proxies /api/*)
[AI Planner Backend] (internal port 3001)
    ↓
[PostgreSQL] (internal port 5432)
```

## Prerequisites

1. **Domain name** pointing to your server
2. **Reverse proxy** already running (Nginx Proxy Manager, Traefik, Caddy, etc.)
3. **Docker network** for the proxy (e.g., `proxy` or `traefik`)

## Option 1: Nginx Proxy Manager (Recommended)

### Step 1: Create Proxy Network

```bash
# Create the external network (if not already exists)
docker network create proxy
```

### Step 2: Configure Environment

```bash
# Create production environment file
cp .env.prod.example .env.prod

# Edit with your values
nano .env.prod
```

Set these variables:
```bash
DOMAIN=calendar.yourdomain.com
POSTGRES_PASSWORD=your_secure_password
ENCRYPTION_KEY=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
FRONTEND_URL=https://calendar.yourdomain.com
GOOGLE_REDIRECT_URI=https://calendar.yourdomain.com/api/auth/callback
# ... other values
```

### Step 3: Start the Stack

```bash
# Start in detached mode
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Check status
docker-compose -f docker-compose.prod.yml ps
```

### Step 4: Configure Nginx Proxy Manager

1. **Login to NPM** (usually at http://your-server:81)

2. **Add Proxy Host**:
   - **Domain Names**: `calendar.yourdomain.com`
   - **Scheme**: `http`
   - **Forward Hostname / IP**: `ai-planner-frontend-prod`
   - **Forward Port**: `80`
   - **Cache Assets**: ✅ (enabled)
   - **Block Common Exploits**: ✅ (enabled)
   - **Websockets Support**: ✅ (enabled)

3. **SSL Tab**:
   - **SSL Certificate**: Request a new Let's Encrypt certificate
   - **Force SSL**: ✅ (enabled)
   - **HTTP/2 Support**: ✅ (enabled)
   - **HSTS Enabled**: ✅ (enabled)
   - **Email**: your@email.com

4. **Save**

### Step 5: Verify

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Test the site
curl -I https://calendar.yourdomain.com

# Should return 200 OK
```

## Option 2: Traefik

### Step 1: Create Traefik Network

```bash
# Create the external network
docker network create traefik
```

### Step 2: Update docker-compose.prod.yml

Change the network name from `proxy` to `traefik`:

```yaml
networks:
  ai-planner-network:
    driver: bridge
  traefik:
    external: true
```

And update the frontend service:

```yaml
frontend:
  # ... other config
  networks:
    - ai-planner-network
    - traefik  # Changed from 'proxy'
```

### Step 3: Configure Environment

Same as Nginx Proxy Manager (see above).

### Step 4: Start the Stack

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### Step 5: Traefik Configuration

The labels in `docker-compose.prod.yml` will automatically configure Traefik:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.ai-planner.rule=Host(`${DOMAIN}`)"
  - "traefik.http.routers.ai-planner.entrypoints=websecure"
  - "traefik.http.routers.ai-planner.tls.certresolver=letsencrypt"
  - "traefik.http.services.ai-planner.loadbalancer.server.port=80"
```

Make sure your Traefik is configured with Let's Encrypt.

## Option 3: Caddy

### Step 1: Create Proxy Network

```bash
docker network create proxy
```

### Step 2: Caddyfile Configuration

Add to your Caddyfile:

```caddyfile
calendar.yourdomain.com {
    reverse_proxy ai-planner-frontend-prod:80

    # Optional: Enable gzip
    encode gzip

    # Optional: Set headers
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
    }
}
```

### Step 3: Reload Caddy

```bash
docker exec -w /etc/caddy caddy caddy reload
```

## Common Issues & Solutions

### Issue: "network proxy not found"

**Solution**: Create the network first
```bash
docker network create proxy
# or
docker network create traefik
```

### Issue: 502 Bad Gateway

**Causes**:
1. Frontend container not running
2. Frontend not on the proxy network
3. Wrong container name

**Solution**:
```bash
# Check container is running
docker ps | grep ai-planner-frontend

# Check networks
docker network inspect proxy

# Restart the stack
docker-compose -f docker-compose.prod.yml restart frontend
```

### Issue: Google OAuth Redirect Mismatch

**Cause**: `GOOGLE_REDIRECT_URI` doesn't match your domain

**Solution**:
1. Update `.env.prod`:
   ```bash
   GOOGLE_REDIRECT_URI=https://calendar.yourdomain.com/api/auth/callback
   ```

2. Update Google Cloud Console:
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Edit OAuth 2.0 Client
   - Add authorized redirect URI: `https://calendar.yourdomain.com/api/auth/callback`

### Issue: CORS Errors

**Cause**: `FRONTEND_URL` doesn't match your domain

**Solution**: Update `.env.prod`:
```bash
FRONTEND_URL=https://calendar.yourdomain.com
```

Then restart:
```bash
docker-compose -f docker-compose.prod.yml restart backend
```

## Security Best Practices

### 1. Use Strong Passwords

```bash
# Generate secure password
openssl rand -base64 32

# Update .env.prod
POSTGRES_PASSWORD=<generated-password>
```

### 2. Enable HTTPS Only

In your reverse proxy:
- ✅ Force SSL/HTTPS
- ✅ HTTP/2 enabled
- ✅ HSTS enabled

### 3. Set Proper Headers

Your reverse proxy should set these headers:
```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

Nginx Proxy Manager does this automatically with "Block Common Exploits" enabled.

### 4. Limit Access (Optional)

If you want to restrict access by IP:

**Nginx Proxy Manager**:
- Go to Access List
- Create new access list with allowed IPs
- Apply to your proxy host

**Traefik**:
```yaml
labels:
  - "traefik.http.middlewares.ai-planner-ipwhitelist.ipwhitelist.sourcerange=192.168.1.0/24,10.0.0.0/8"
  - "traefik.http.routers.ai-planner.middlewares=ai-planner-ipwhitelist"
```

### 5. Enable Rate Limiting (Optional)

**Nginx Proxy Manager**: Use Custom Nginx Configuration
```nginx
limit_req_zone $binary_remote_addr zone=ai_planner:10m rate=10r/s;
limit_req zone=ai_planner burst=20 nodelay;
```

## Monitoring

### Check Container Status

```bash
# All containers
docker-compose -f docker-compose.prod.yml ps

# Specific service
docker-compose -f docker-compose.prod.yml logs -f frontend
```

### Check Reverse Proxy

**Nginx Proxy Manager**: Web UI → Hosts → View logs

**Traefik**:
```bash
docker logs traefik -f
```

### Check Application Logs

```bash
# Frontend logs
docker-compose -f docker-compose.prod.yml logs -f frontend

# Backend logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Database logs
docker-compose -f docker-compose.prod.yml logs -f postgres
```

## Backup & Restore

### Backup Database

```bash
# Create backup directory
mkdir -p backups

# Backup database
docker-compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U ai_planner ai_planner > backups/backup-$(date +%Y%m%d-%H%M%S).sql
```

### Restore Database

```bash
# Restore from backup
cat backups/backup-20250130-120000.sql | \
  docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U ai_planner -d ai_planner
```

### Automated Backups

Create `backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d-%H%M%S)

docker-compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U ai_planner ai_planner > "$BACKUP_DIR/backup-$DATE.sql"

# Keep only last 30 days
find "$BACKUP_DIR" -name "backup-*.sql" -mtime +30 -delete

echo "Backup completed: backup-$DATE.sql"
```

Schedule with cron:
```bash
# Run daily at 2 AM
0 2 * * * /path/to/backup.sh
```

## Updating the Application

### Update Code

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build
```

### Update Single Service

```bash
# Rebuild frontend only
docker-compose -f docker-compose.prod.yml up -d --build frontend

# Rebuild backend only
docker-compose -f docker-compose.prod.yml up -d --build backend
```

### Zero-Downtime Updates

For frontend updates:
```bash
# Build new image
docker-compose -f docker-compose.prod.yml build frontend

# Scale up
docker-compose -f docker-compose.prod.yml up -d --scale frontend=2

# Wait for new container to be healthy
sleep 10

# Scale back down (removes old container)
docker-compose -f docker-compose.prod.yml up -d --scale frontend=1
```

## Troubleshooting Commands

```bash
# Check which networks a container is on
docker inspect ai-planner-frontend-prod | grep -A 10 Networks

# Test connection from proxy to frontend
docker run --rm --network proxy curlimages/curl curl -I http://ai-planner-frontend-prod

# Check if container is accessible
docker exec -it ai-planner-frontend-prod wget -O- http://localhost

# View all containers on proxy network
docker network inspect proxy

# Restart everything
docker-compose -f docker-compose.prod.yml restart

# Clean restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

## Example: Complete Setup with Nginx Proxy Manager

```bash
# 1. Create network
docker network create proxy

# 2. Configure environment
cp .env.prod.example .env.prod
nano .env.prod  # Edit with your values

# 3. Start the stack
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 4. Check status
docker-compose -f docker-compose.prod.yml ps

# 5. Configure NPM (via web UI)
# - Domain: calendar.yourdomain.com
# - Forward to: ai-planner-frontend-prod:80
# - Enable SSL with Let's Encrypt

# 6. Verify
curl -I https://calendar.yourdomain.com

# 7. Monitor
docker-compose -f docker-compose.prod.yml logs -f
```

## Support

If you encounter issues:

1. Check container logs: `docker-compose -f docker-compose.prod.yml logs -f`
2. Verify network connectivity: `docker network inspect proxy`
3. Check reverse proxy logs (NPM web UI or Traefik logs)
4. Ensure `.env.prod` has correct values
5. Verify DNS is pointing to your server

For more help, see:
- [DOCKER.md](./DOCKER.md) - Docker commands and troubleshooting
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Cloud deployment options
- [README.md](./README.md) - General documentation
