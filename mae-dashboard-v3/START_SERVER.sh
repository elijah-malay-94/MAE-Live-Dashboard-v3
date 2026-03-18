#!/bin/bash
echo "========================================"
echo "MAE Dashboard - Starting Live Server"
echo "========================================"
echo ""
echo "Starting server on http://localhost:8080"
echo "Browser will reload automatically on file changes"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
cd "$(dirname "$0")"
if ! command -v live-server &> /dev/null; then
  echo "live-server not found. Installing..."
  npm install -g live-server
fi
live-server --port=8080 --open=index.html
