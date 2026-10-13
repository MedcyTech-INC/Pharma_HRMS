#!/usr/bin/env bash
set -e

# ====================================================================
# Pharma HRMS Backend - 1-Click Docker Deployment Script for PuTTY/VPS
# ====================================================================

echo "=========================================================="
echo "🚀 Starting Pharma HRMS Backend Deployment on Docker..."
echo "=========================================================="

# 1. Check for .env file
if [ ! -f .env ]; then
  echo "⚠️ .env file not found. Copying .env.example -> .env..."
  cp .env.example .env
  echo "✅ Created .env. Please update your database and secret keys if needed."
fi

# 2. Extract port from .env or fallback to 8085
APP_PORT=$(grep -E '^APP_PORT=' .env | cut -d '=' -f2 | tr -d '"' | tr -d "'" || echo "8085")
APP_PORT=${APP_PORT:-8085}

echo "📌 Target Port configured: ${APP_PORT}"

# 3. Check if target port is already in use
if command -v netstat >/dev/null 2>&1; then
  if netstat -tuln | grep -q ":${APP_PORT} "; then
    echo "⚠️ Warning: Port ${APP_PORT} appears to be in use on this machine."
    echo "👉 You can change APP_PORT in .env to another port (e.g. 8086, 8095, 8888)."
  fi
elif command -v ss >/dev/null 2>&1; then
  if ss -tuln | grep -q ":${APP_PORT} "; then
    echo "⚠️ Warning: Port ${APP_PORT} appears to be in use on this machine."
    echo "👉 You can change APP_PORT in .env to another port (e.g. 8086, 8095, 8888)."
  fi
fi

# 4. Build and start containers
echo "🔨 Building Docker image and starting service..."
docker compose down --remove-orphans || true
docker compose up -d --build

# 5. Wait for container to be ready
echo "⏳ Waiting for health check verification (10s)..."
sleep 10

# 6. Verify health
echo "🔍 Container Status:"
docker compose ps

echo ""
echo "🩺 Testing /api/health endpoint on port ${APP_PORT}..."
if command -v curl >/dev/null 2>&1; then
  HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${APP_PORT}/api/health || echo "FAILED")
  if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Backend is ONLINE and Healthy! (HTTP 200)"
  else
    echo "⚠️ Health check returned status: $HEALTH_STATUS. Check logs with: docker compose logs -f"
  fi
fi

echo ""
echo "=========================================================="
echo "🎉 Deployment Complete!"
echo "📡 Base URL: http://<YOUR_SERVER_IP>:${APP_PORT}/api"
echo "📖 Swagger API Docs: http://<YOUR_SERVER_IP>:${APP_PORT}/api/docs"
echo "📜 View Logs: docker compose logs -f"
echo "🛑 Stop Container: docker compose down"
echo "=========================================================="
