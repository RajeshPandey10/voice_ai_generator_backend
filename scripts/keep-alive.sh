#!/bin/bash

# External keep-alive script for Render service
# You can run this on any external service like GitHub Actions or a cron job

SERVICE_URL="https://voice-ai-generator-backend.onrender.com"
HEALTH_ENDPOINT="$SERVICE_URL/health"

echo "🔄 Pinging service at $HEALTH_ENDPOINT"

response=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_ENDPOINT")

if [ "$response" = "200" ]; then
    echo "✅ Service is alive! Response: $response"
else
    echo "❌ Service might be sleeping. Response: $response"
    echo "🔄 Attempting to wake up service..."
    # Try a few more times
    for i in {1..3}; do
        sleep 5
        response=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_ENDPOINT")
        echo "   Attempt $i: Response $response"
        if [ "$response" = "200" ]; then
            echo "✅ Service is now awake!"
            break
        fi
    done
fi

echo "📊 Timestamp: $(date)"
