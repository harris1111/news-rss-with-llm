#!/bin/bash
set -e

case "$SERVICE_NAME" in
  RSS_MAIN)
    echo "Starting RSS Main Process (Producer)..."
    exec node dist/main.js
    ;;
  RSS_WORKER)
    echo "Starting RSS Worker Process (Consumer)..."
    exec node dist/worker.js
    ;;
  AI_SEARCH)
    echo "Starting AI Search Service..."
    exec node dist/ai-search-app.js
    ;;
  RSS_ALL)
    echo "Starting RSS Main + Worker Process..."
    node dist/main.js &
    exec node dist/worker.js
    ;;
  *)
    echo "Unknown service: $SERVICE_NAME"
    echo "Available services: RSS_MAIN, RSS_WORKER, AI_SEARCH, RSS_ALL"
    exit 1
    ;;
esac 