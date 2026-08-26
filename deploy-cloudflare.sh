#!/bin/bash
# ============================================================
# StudentTemp — One-Command Free Deployment Script
# ============================================================
# This script deploys the project to Cloudflare Pages with a free
# *.pages.dev subdomain. No domain purchase required.
#
# PREREQUISITES (you must do these manually — they need email verification):
#
# 1. Create a Cloudflare account (free, no card):
#    → https://dash.cloudflare.com/sign-up
#    → After signup, go to Dashboard → Workers & Pages → Get started
#
# 2. Create a Neon Postgres database (free, no card):
#    → https://neon.tech
#    → Create a project → Copy the connection string
#    → It looks like: postgresql://user:pass@ep-xxx.region.aws.neon.tech/studenttemp?sslmode=require
#
# 3. Create a Resend account (free, no card — 100 emails/day):
#    → https://resend.com
#    → Create API key → Copy it (re_xxxxx...)
#
# 4. Install Wrangler CLI and login:
#    npm install -g wrangler
#    wrangler login  # opens browser for Cloudflare OAuth
#
# 5. Run this script:
#    bash deploy-cloudflare.sh
#
# ============================================================

set -e

echo "=========================================="
echo "  StudentTemp — Free Cloudflare Deployment"
echo "=========================================="
echo ""

# Check prerequisites
if ! command -v wrangler &> /dev/null; then
  echo "❌ wrangler not installed. Run: npm install -g wrangler && wrangler login"
  exit 1
fi

# Check for required environment variables
MISSING=0
if [ -z "$NEON_DATABASE_URL" ]; then
  echo "❌ NEON_DATABASE_URL not set."
  echo "   Get it from: https://neon.tech → Your Project → Connection String"
  echo "   Export it: export NEON_DATABASE_URL='postgresql://...'"
  MISSING=1
fi
if [ -z "$RESEND_API_KEY" ]; then
  echo "❌ RESEND_API_KEY not set."
  echo "   Get it from: https://resend.com → API Keys"
  echo "   Export it: export RESEND_API_KEY='re_xxxxx...'"
  MISSING=1
fi
if [ "$MISSING" -eq 1 ]; then
  echo ""
  echo "Set the missing variables and re-run this script."
  exit 1
fi

echo "✅ All prerequisites found"
echo ""

# Generate fresh VAPID keys (never reuse sandbox keys)
echo "🔑 Generating fresh VAPID keys..."
npx web-push generate-vapid-keys > /tmp/vapid-keys.txt 2>&1
VAPID_PUBLIC=$(grep "Public Key:" /tmp/vapid-keys.txt | awk '{print $NF}')
VAPID_PRIVATE=$(grep "Private Key:" /tmp/vapid-keys.txt | awk '{print $NF}')
echo "   Public: ${VAPID_PUBLIC:0:20}..."
echo "   Private: ${VAPID_PRIVATE:0:10}..."
echo ""

# Generate site access password hash
echo "🔐 Generating site access password hash..."
ACCESS_HASH=$(echo -n 'StudentTemp#8800Roshan' | sha256sum | awk '{print $1}')
echo "   Hash: ${ACCESS_HASH:0:20}..."
echo ""

# Push database schema to Neon
echo "📊 Pushing database schema to Neon..."
DATABASE_URL="$NEON_DATABASE_URL" npx prisma db push --accept-data-loss 2>&1 | tail -5
echo ""

# Seed the database with domains
echo "🌱 Seeding database with 94 domains..."
DATABASE_URL="$NEON_DATABASE_URL" bun run prisma/seed.ts 2>&1 | tail -3
echo ""

# Build for Cloudflare Pages
echo "📦 Building for Cloudflare Pages..."
npx @cloudflare/next-on-pages 2>&1 | tail -10
echo ""

# Deploy to Cloudflare Pages
echo "🚀 Deploying to Cloudflare Pages..."
wrangler pages deploy .vercel/output/static \
  --project-name studenttemp \
  --branch main \
  2>&1 | tee /tmp/deploy-output.txt

# Extract the deployment URL
DEPLOY_URL=$(grep -o 'https://[a-z0-9]*\.studenttemp\.pages\.dev' /tmp/deploy-output.txt | head -1)
if [ -z "$DEPLOY_URL" ]; then
  DEPLOY_URL=$(grep -o 'https://[a-z0-9-]*\.pages\.dev' /tmp/deploy-output.txt | head -1)
fi

echo ""
echo "=========================================="
if [ -n "$DEPLOY_URL" ]; then
  echo "✅ DEPLOYED! Your site is live at:"
  echo "   $DEPLOY_URL"
  echo ""
  echo "⚠️  Now set these environment variables in the Cloudflare dashboard:"
  echo "   Dashboard → Workers & Pages → studenttemp → Settings → Environment variables"
  echo ""
  echo "   DATABASE_URL = $NEON_DATABASE_URL"
  echo "   NEXT_PUBLIC_VAPID_PUBLIC_KEY = $VAPID_PUBLIC"
  echo "   VAPID_PRIVATE_KEY = $VAPID_PRIVATE"
  echo "   SITE_ACCESS_PASSWORD_HASH = $ACCESS_HASH"
  echo "   RESEND_API_KEY = $RESEND_API_KEY"
  echo "   PUBLIC_BASE_URL = $DEPLOY_URL"
  echo "   NODE_ENV = production"
  echo ""
  echo "   After setting variables, trigger a redeploy:"
  echo "   Dashboard → Workers & Pages → studenttemp → Deployments → Retry deployment"
else
  echo "⚠️  Check /tmp/deploy-output.txt for the deployment URL"
fi
echo "=========================================="
