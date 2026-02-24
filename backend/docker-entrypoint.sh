#!/bin/sh
set -e

echo "⏳  Waiting for PostgreSQL to be ready..."
until node -e "
  const { Pool } = require('pg');
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  p.query('SELECT 1').then(() => { p.end(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 1
done

echo "✅  Database is ready."
echo "🔄  Running migrations..."
node db/migrate.js up

echo "🚀  Starting server..."
exec node server.js
