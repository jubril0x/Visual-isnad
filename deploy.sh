#!/usr/bin/env bash
# Stop execution if any command fails
set -e

# Require a commit message
if [ -z "$1" ]; then
  echo "Error: Please provide a commit message."
  echo 'Usage: ./deploy.sh "your commit message"'
  exit 1
fi

echo "Adding changes..."
git add .

echo "Committing to development..."
git commit -m "$1"

echo "Pushing development to GitHub..."
git push origin development

echo "Merging into main for production deployment..."
git checkout main
git merge development
git push origin main

echo "Returning to development branch..."
git checkout development

echo " Deployment triggered successfully!"