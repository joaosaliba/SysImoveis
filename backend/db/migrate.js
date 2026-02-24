#!/usr/bin/env node
/**
 * db/migrate.js — Migration runner for GestaoImoveis
 *
 * Usage:
 *   node db/migrate.js up            → Apply all pending migrations
 *   node db/migrate.js status        → List migrations and their status
 *   node db/migrate.js create <name> → Create a new empty migration file
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Helpers ────────────────────────────────────────────────────────────────

async function ensureMigrationsTable(client) {
    await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    VARCHAR(10)              PRIMARY KEY,
      name       TEXT                     NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

function getMigrationFiles() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    }
    return fs
        .readdirSync(MIGRATIONS_DIR)
        .filter(f => /^\d{3}_.*\.sql$/.test(f))
        .sort();
}

function parseFile(filename) {
    const match = filename.match(/^(\d{3})_(.+)\.sql$/);
    return match ? { version: match[1], name: match[2] } : null;
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function cmdUp() {
    const client = await pool.connect();
    try {
        await ensureMigrationsTable(client);

        const { rows } = await client.query('SELECT version FROM schema_migrations');
        const applied = new Set(rows.map(r => r.version));

        const files = getMigrationFiles();
        const pending = files.filter(f => {
            const parsed = parseFile(f);
            return parsed && !applied.has(parsed.version);
        });

        if (pending.length === 0) {
            console.log('✅  All migrations are up to date.');
            return;
        }

        for (const file of pending) {
            const { version, name } = parseFile(file);
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

            console.log(`⏳  Applying ${file}…`);
            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query(
                    'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
                    [version, name]
                );
                await client.query('COMMIT');
                console.log(`✅  Applied  ${file}`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`❌  Failed   ${file}`);
                console.error(`    ${err.message}`);
                process.exit(1);
            }
        }

        console.log(`\n🎉  ${pending.length} migration(s) applied.`);
    } finally {
        client.release();
        await pool.end();
    }
}

async function cmdStatus() {
    const client = await pool.connect();
    try {
        await ensureMigrationsTable(client);

        const { rows } = await client.query(
            'SELECT version, name, applied_at FROM schema_migrations ORDER BY version'
        );
        const applied = new Map(rows.map(r => [r.version, r]));

        const files = getMigrationFiles();
        if (files.length === 0) {
            console.log('No migration files found in db/migrations/');
            return;
        }

        console.log('\n  Ver  │ Status  │ Name                            │ Applied At');
        console.log('  ─────┼─────────┼─────────────────────────────────┼──────────────────────');

        for (const file of files) {
            const { version, name } = parseFile(file);
            if (applied.has(version)) {
                const row = applied.get(version);
                const date = new Date(row.applied_at).toISOString().replace('T', ' ').substring(0, 19);
                console.log(`  ${version}  │ ✅ done  │ ${name.padEnd(31)} │ ${date}`);
            } else {
                console.log(`  ${version}  │ ⏳ pend  │ ${name.padEnd(31)} │`);
            }
        }
        console.log();
    } finally {
        client.release();
        await pool.end();
    }
}

async function cmdCreate(name) {
    if (!name) {
        console.error('Usage: migrate create <name>');
        process.exit(1);
    }

    const files = getMigrationFiles();
    const lastVersion = files.length
        ? parseInt(parseFile(files[files.length - 1]).version, 10)
        : 0;
    const nextVersion = String(lastVersion + 1).padStart(3, '0');
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const filename = `${nextVersion}_${slug}.sql`;
    const filepath = path.join(MIGRATIONS_DIR, filename);

    const template = `-- =============================================\n-- Migration ${nextVersion}: ${slug}\n-- Created: ${new Date().toISOString()}\n-- =============================================\n\n-- Write your migration SQL here\n`;

    fs.writeFileSync(filepath, template, 'utf8');
    console.log(`✅  Created migration: db/migrations/${filename}`);
    await pool.end();
}

// ─── Main ────────────────────────────────────────────────────────────────────

const [, , command, ...args] = process.argv;

(async () => {
    switch (command) {
        case 'up':
        case undefined:
            await cmdUp();
            break;
        case 'status':
            await cmdStatus();
            break;
        case 'create':
            await cmdCreate(args[0]);
            break;
        default:
            console.error(`Unknown command: "${command}". Use: up | status | create <name>`);
            process.exit(1);
    }
})().catch(err => {
    console.error('Migration error:', err.message);
    process.exit(1);
});
