#!/usr/bin/env bash
# Render build script (Root Directory should be `backend`).
set -o errexit
set -o nounset
set -o pipefail

cd "$(dirname "$0")"

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Collecting static files..."
python manage.py collectstatic --no-input

echo "Running database migrations..."
python manage.py migrate --no-input

echo "Ensuring editor superuser..."
python manage.py ensure_superuser

echo "Build complete."
