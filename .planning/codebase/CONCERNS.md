# Codebase Concerns

**Analysis Date:** 2026-02-24

## Security Considerations

### Hardcoded Credentials in Docker Configuration

**Risk:** Production secrets exposed in version control

**Files:** `docker-compose.yml`

**Current State:**
```yaml
environment:
  JWT_SECRET: gestao_imoveis_jwt_secret_2026_super_secure
  JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:-gestao_refresh_secret_2026}
  POSTGRES_PASSWORD: postgres
  ADMIN_PASSWORD: ${ADMIN_PASSWORD:-admin123}
```

**Impact:** Anyone with repository access can forge JWT tokens, access the database, and log in as admin. Default credentials (`admin123`, `postgres`) are publicly known.

**Recommendations:**
- Use Docker secrets or external secret management (Vault, AWS Secrets Manager)
- Remove hardcoded defaults, require env vars at runtime
- Add `docker-compose.yml` to `.gitignore` and use `docker-compose.override.yml` pattern

### Weak JWT Configuration

**Risk:** Token forgery and session hijacking

**Files:** `backend/middleware/auth.js`, `backend/routes/auth.js`

**Current State:**
```javascript
// Hardcoded secret fallback in docker-compose
JWT_SECRET: gestao_imoveis_jwt_secret_2026_super_secure
// Short expiration but no rotation mechanism
{ expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
```

**Impact:** If JWT secret is compromised, all sessions are vulnerable. No token rotation or blacklist for revoked tokens.

**Recommendations:**
- Implement JWT refresh token rotation (invalidate old refresh token on each use)
- Add token blacklist for logout scenarios
- Use cryptographically secure random secret generation

### SQL Injection Risk via String Concatenation

**Risk:** Potential SQL injection in dynamic queries

**Files:** `backend/routes/contratos.js`, `backend/routes/propriedades.js`, `backend/routes/dashboard.js`

**Current State:**
```javascript
// contratos.js:511-523 - Query built with string concatenation
let query = `SELECT cp.* FROM contrato_parcelas cp ... WHERE 1=1`;
if (dt_inicio) {
    query += ` AND cp.data_vencimento >= $${paramIndex++}`;
}

// propriedades.js:16-24 - WHERE clause built dynamically
let whereClause = '';
if (search) {
    whereClause = ` WHERE p.endereco ILIKE $${paramIndex}...`;
}
```

**Impact:** While parameterized queries are used for values, the query structure itself is built via string concatenation. A vulnerability in the parameter index logic could allow injection.

**Recommendations:**
- Use a query builder library (Knex.js, Kyseli)
- Consider an ORM (Prisma, TypeORM) for type-safe queries
- Add input validation for all filter parameters

### Insecure Token Transmission via Query Parameters

**Risk:** Token exposure in server logs and browser history

**Files:** `backend/middleware/auth.js:7-10`

**Current State:**
```javascript
// Fallback to query parameter for specific cases like direct browser redirects
if (!token && req.query.token) {
    token = req.query.token;
}
```

**Impact:** URLs with tokens may be logged by proxies, saved in browser history, or leaked via Referer headers.

**Recommendations:**
- Remove query parameter token support
- Use POST endpoints with tokens in body for sensitive operations
- For printing routes, generate short-lived signed URLs instead

### Missing Rate Limiting

**Risk:** Brute force attacks on authentication endpoints

**Files:** `backend/server.js`, `backend/routes/auth.js`

**Current State:** No rate limiting middleware configured.

**Impact:** Login endpoint can be brute-forced. Token refresh endpoint vulnerable to abuse.

**Recommendations:**
- Add `express-rate-limit` middleware
- Implement per-IP and per-user rate limits
- Add progressive delays after failed attempts

## Tech Debt

### TypeScript Build Errors Ignored

**Files:** `frontend/next.config.ts:10-14`

**Current State:**
```typescript
typescript: {
  ignoreBuildErrors: true,
},
eslint: {
  ignoreDuringBuilds: true,
},
```

**Impact:** Type errors and linting issues accumulate without blocking builds. Code quality degrades over time.

**Recommendations:**
- Run `tsc --noEmit` locally to identify current errors
- Fix all existing type errors incrementally
- Remove `ignoreBuildErrors` once codebase is clean

### Deprecated Package: Moment.js

**Files:** `backend/package.json:16`

**Current State:**
```json
"moment": "^2.30.1"
```

**Impact:** Moment.js is in maintenance mode (no new features, only critical fixes). Larger bundle size, performance issues.

**Recommendations:**
- Replace with `dayjs` (API-compatible, smaller) or `date-fns` (already used in frontend)
- The frontend already uses `date-fns` - consolidate on one library

### TODO: Missing Contract Data in List View

**Files:** `frontend/src/app/(dashboard)/contratos/page.tsx:311`

**Current State:**
```typescript
valor_iptu: '', // TODO: These are not in the main contract object in list view, might need detail fetch if not available
```

**Impact:** Contract creation form may have incomplete data, requiring extra API calls or manual entry.

**Recommendations:**
- Update backend `/contratos/` endpoint to include breakdown fields in list response
- Or fetch contract details when creating installments

### Excessive Console Logging

**Files:** Throughout codebase - 70+ console statements found

**Current State:**
```javascript
// backend/routes/contratos.js - 20+ console.error calls
console.error('List contracts error:', err);
console.error('Get contract error:', err);
// ...

// frontend/src/lib/api.ts
console.log(`[API] Fetching: ${url}`);
console.warn(`[API] Network error...`);
```

**Impact:** Production logs polluted with debug statements. Sensitive data may leak to logs. Performance overhead.

**Recommendations:**
- Implement structured logging (Winston, Pino)
- Add log levels (DEBUG, INFO, WARN, ERROR)
- Remove console.log/warn from production builds

### Large Route Files

**Files:** `backend/routes/contratos.js` (1077 lines)

**Current State:** Single file handles:
- Contract CRUD (6 endpoints)
- Installment management (10+ endpoints)
- Boleto generation (PDF/HTML)
- Bulk operations
- Renewal handling

**Impact:** Difficult to maintain, test, and extend. High cognitive load for developers.

**Recommendations:**
- Extract installment routes to `routes/parcelas.js`
- Extract boleto/report routes to `routes/relatorios.js` (already exists, move related code)
- Extract renewal logic to dedicated service

## Known Bugs

### Contract Renewal Overlap Logic Flaw

**Files:** `backend/routes/contratos.js:193-201`

**Current State:**
```javascript
const currentStart = new Date(contrato.data_inicio);
const currentEnd = new Date(contrato.data_fim);
const newStart = new Date(nova_data_inicio);
const newEnd = new Date(nova_data_fim);

if (newStart <= currentEnd && newEnd >= currentStart) {
    return res.status(400).json({ error: 'O novo período de renovação se sobrepõe...' });
}
```

**Symptoms:** Valid renewals may be rejected. The condition allows overlap with the *original* period, not considering previous renewals.

**Trigger:** Renew a contract that has already been renewed before.

**Workaround:** Manually calculate non-overlapping dates before submitting renewal.

**Fix:** Check overlap against the *current active period* after all renewals, not the original contract dates. Query `contrato_renovacoes` to find the actual current period.

### Race Condition in Bulk Installment Updates

**Files:** `backend/routes/contratos.js:671-710`

**Current State:**
```javascript
await client.query('BEGIN');
// Update all with ANY operator
await client.query(
    `UPDATE contrato_parcelas SET status_pagamento = $1 WHERE id = ANY($2::uuid[])`,
    [status, ids]
);
await client.query('COMMIT');
```

**Symptoms:** If two admins update the same installments simultaneously, one update may silently overwrite the other.

**Impact:** Payment status may be incorrectly changed (e.g., "pago" reverted to "pendente").

**Fix:** Add optimistic locking with `updated_at` check:
```sql
WHERE id = ANY($2::uuid[]) AND status_pagamento = 'pendente'
```

### Unit Status Not Synced on Property Delete

**Files:** `backend/routes/propriedades.js:127-142`

**Current State:**
```javascript
router.delete('/:id', async (req, res) => {
    const result = await pool.query('DELETE FROM propriedades WHERE id = $1', [req.params.id]);
    // Catches FK error but doesn't handle unit cleanup
});
```

**Symptoms:** If property has units with no active contracts, delete may fail with FK constraint error.

**Fix:** Implement cascade delete or check for units before deletion:
```javascript
const unitsCheck = await pool.query('SELECT id FROM unidades WHERE propriedade_id = $1', [id]);
if (unitsCheck.rows.length > 0) {
    return res.status(409).json({ error: 'Propriedade possui unidades...' });
}
```

## Performance Bottlenecks

### Missing Database Indexes on Frequently Queried Columns

**Files:** `backend/db/schema.sql`

**Current State:** Indexes exist for basic foreign keys, but missing:
- `contratos(data_inicio, data_fim)` - for date range queries
- `contrato_parcelas(data_vencimento, status_pagamento)` - for boleto filtering
- `propriedades(cidade, uf)` - for location search

**Impact:** Dashboard queries and boleto filters scan entire tables.

**Fix:** Add composite indexes:
```sql
CREATE INDEX idx_parcelas_vencimento_status ON contrato_parcelas(data_vencimento, status_pagamento);
CREATE INDEX idx_contratos_periodo ON contratos(data_inicio, data_fim);
```

### Inefficient Dashboard Revenue Query

**Files:** `backend/routes/dashboard.js:67-76`

**Current State:**
```javascript
SELECT to_char(date_trunc('month', data_pagamento), 'MM/YYYY') as mes,
       COALESCE(SUM(valor_pago), 0) as total
FROM contrato_parcelas
WHERE status_pagamento = 'pago'
  AND data_pagamento >= (CURRENT_DATE - INTERVAL '12 months')
GROUP BY date_trunc('month', data_pagamento)
```

**Impact:** Full table scan on `contrato_parcelas` for each dashboard load. No index on `(status_pagamento, data_pagamento)`.

**Fix:**
- Add composite index on `(status_pagamento, data_pagamento, valor_pago)`
- Consider materialized view for dashboard KPIs, refreshed hourly

### Synchronous PDF Generation Blocking Event Loop

**Files:** `backend/services/pdfService.js`, `backend/routes/contratos.js:1064-1068`

**Current State:**
```javascript
await generateBulkBoletosPDF(result.rows, filePath);
res.download(filePath, fileName, (err) => { ... });
```

**Impact:** PDFKit operations are CPU-intensive. Large bulk downloads (>50 boletos) block the event loop, affecting other requests.

**Fix:**
- Move PDF generation to worker thread or separate process
- Implement async job queue (Bull, Agenda) with status polling
- Stream PDF directly instead of writing to temp file

## Fragile Areas

### Hardcoded CORS Origin

**Files:** `backend/server.js:18`

**Current State:**
```javascript
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
```

**Why Fragile:** Any deployment to staging/production requires code change. Environment-specific CORS not supported.

**Safe Modification:**
```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({ origin: allowedOrigins, credentials: true }));
```

### Manual Date Arithmetic in Installment Generation

**Files:** `backend/routes/contratos.js:774-810`

**Current State:**
```javascript
nextStart.setMonth(nextStart.getMonth() + 1);
// Safety break to prevent infinite loops
if (currentNum > 120) break;
```

**Why Fragile:** Date arithmetic with `setMonth` has edge cases (e.g., Jan 31 + 1 month = Feb 28/29, not Mar 3). The safety break indicates awareness of potential infinite loops.

**Test Coverage:** None. Date edge cases not tested.

**Safe Modification:**
- Use `date-fns` (already available in frontend, add to backend)
- Add unit tests for edge cases (month-end dates, leap years)

### CEP Lookup Without Caching

**Files:** `frontend/src/app/(dashboard)/imoveis/page.tsx:120-137`

**Current State:**
```typescript
const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
if (!res.ok) alert('CEP não encontrado.');
```

**Why Fragile:** ViaCEP has rate limits. No caching means repeated lookups for same CEP hit external API.

**Safe Modification:**
- Cache CEP results in localStorage (frontend) or Redis (backend)
- Add debounce to prevent rapid-fire requests
- Handle API rate limiting gracefully

## Test Coverage Gaps

### No Automated Tests

**Files:** Entire codebase

**What's Not Tested:**
- Authentication flow (login, refresh, role checks)
- Contract lifecycle (create, renew, close)
- Installment generation logic
- Boleto PDF generation
- Dashboard aggregations

**Risk:** Regression bugs undetected. Refactoring is risky without test safety net.

**Priority:** HIGH

**Recommendations:**
1. Set up Jest/Vitest for backend unit tests
2. Add React Testing Library for frontend component tests
3. Start with critical paths:
   - `backend/routes/auth.js` - login, token refresh
   - `backend/routes/contratos.js` - installment generation
   - `frontend/src/lib/api.ts` - API client error handling

### No E2E Testing

**Files:** Entire codebase

**What's Not Tested:**
- Full user flows (login → create property → create contract → generate boleto)
- Cross-browser compatibility
- Mobile responsiveness

**Recommendations:**
- Add Playwright for E2E testing
- Start with critical business flows
- Integrate with CI pipeline

## Dependency at Risk

### node-boleto Maintenance Status

**Files:** `backend/package.json:17`, `backend/routes/contratos.js:864-894`

**Current State:**
```json
"node-boleto": "^2.3.0"
```

**Risk:** Library has limited maintenance. Boleto rules change periodically per bank. Santander implementation may be outdated.

**Impact:** Generated boletos may be rejected by banks. No support for newer boleto format (BNF).

**Migration Plan:**
- Evaluate alternatives: `cef-boleto`, `laravolt/boleto` (PHP port)
- Consider using a payment gateway API (Asaas, Iugu, Mercado Pago) that handles boleto generation

## Missing Critical Features

### No Audit Logging

**Files:** All route files

**Problem:** No tracking of who changed what and when.

**Impact:** Cannot investigate data corruption or unauthorized changes. No compliance trail.

**Files Affected:** `backend/routes/*.js`

**Recommendation:** Add audit log table and middleware:
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    usuario_id UUID,
    acao VARCHAR(50),
    tabela VARCHAR(50),
    registro_id UUID,
    dados_antigos JSONB,
    dados_novos JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### No Soft Delete for Critical Entities

**Files:** `backend/routes/*.js`

**Problem:** Direct DELETE removes contracts, properties, tenants permanently.

**Impact:** Accidental deletions cause data loss. No recovery mechanism.

**Recommendation:** Add `deleted_at` column and soft delete pattern for:
- `contratos`
- `propriedades`
- `unidades`
- `inquilinos`

---

*Concerns audit: 2026-02-24*
