# Architecture

**Analysis Date:** 2026-02-24

## Pattern Overview

**Overall:** Client-Server Architecture with REST API

**Key Characteristics:**
- Backend: Node.js/Express REST API with middleware-based authentication
- Frontend: Next.js 16 App Router with Server-Side Rendering capabilities
- Database: PostgreSQL with UUID-based primary keys
- Authentication: JWT with access token (15min) and refresh token (7 days)
- Role-based access control (RBAC) with three user roles

## Layers

**Backend API Layer:**
- Purpose: RESTful API serving all CRUD operations and business logic
- Location: `backend/`
- Contains: Route handlers, middleware, database connection pool
- Depends on: Express, pg (PostgreSQL client), jsonwebtoken, bcryptjs
- Used by: Frontend via HTTP requests

**Database Layer:**
- Purpose: Persistent data storage with relational schema
- Location: `backend/db/`
- Contains: Connection pool, migrations, seed scripts, pagination utilities
- Depends on: PostgreSQL driver (pg)
- Used by: All backend routes

**Frontend Presentation Layer:**
- Purpose: User interface and client-side state management
- Location: `frontend/src/app/` and `frontend/src/components/`
- Contains: Pages (App Router), React components, API client
- Depends on: React 19, Next.js 16, Tailwind CSS 4
- Used by: End users via browser

**Authentication Layer:**
- Purpose: Secure user authentication and authorization
- Location: `backend/middleware/auth.js` and `frontend/src/lib/api.ts`
- Contains: JWT verification, role checking, token refresh logic
- Pattern: Bearer token in Authorization header

## Data Flow

**User Login Flow:**

1. User submits credentials at `frontend/src/app/login/page.tsx`
2. `api.login()` sends POST to `/api/auth/login`
3. Backend validates credentials against `usuarios` table
4. Backend returns access token, refresh token, and user object
5. Frontend stores tokens in localStorage
6. User is redirected to `/dashboard`

**Protected Route Access:**

1. Frontend component calls `api.get('/endpoint')`
2. `request()` function in `frontend/src/lib/api.ts` attaches Bearer token
3. Backend `verifyToken` middleware validates JWT
4. Route handler processes request and queries database
5. Response returns through middleware chain to client

**Contract Creation with Installments:**

1. User fills contract form in frontend
2. POST `/api/contratos` creates contract record
3. `generateParcelas()` function auto-generates monthly installments
4. Each installment inserted into `contrato_parcelas` table
5. Unit status updated to 'alugado'
6. Full contract with parcelas returned to frontend

**State Management:**
- Authentication state: localStorage (accessToken, refreshToken, user)
- UI state: React useState/useEffect hooks
- No centralized state management library (Redux/Zustand) - component-level state

## Key Abstractions

**Middleware Pattern:**
- Purpose: Cross-cutting concerns (auth, logging)
- Examples: `backend/middleware/auth.js`
- Pattern: Express middleware functions that intercept requests

**Pagination Utility:**
- Purpose: Standardized pagination across all list endpoints
- Location: `backend/db/pagination.js`
- Functions: `getPaginationParams()`, `formatPaginatedResponse()`

**API Client:**
- Purpose: Centralized HTTP client with auth handling
- Location: `frontend/src/lib/api.ts`
- Pattern: Wrapper around fetch() with automatic token refresh

**Database Pool:**
- Purpose: PostgreSQL connection pooling
- Location: `backend/db/pool.js`
- Pattern: Singleton pg.Pool instance

## Entry Points

**Backend Entry Point:**
- Location: `backend/server.js`
- Triggers: Server startup via `node server.js` or `npm run dev`
- Responsibilities:
  - Initialize Express app
  - Configure CORS (origin: http://localhost:3000)
  - Register middleware (JSON parser, request logger)
  - Mount route handlers under `/api/*`
  - Initialize admin user via `initAdmin()`
  - Listen on PORT 3001

**Frontend Entry Point:**
- Location: `frontend/src/app/layout.tsx` and `frontend/src/app/page.tsx`
- Triggers: Browser navigation
- Responsibilities:
  - Root layout provides HTML structure and fonts
  - Home page redirects authenticated users to `/dashboard`
  - Dashboard layout (`frontend/src/app/(dashboard)/layout.tsx`) wraps protected pages

**Route Entry Points (Backend):**
| Route Prefix | File | Purpose |
|--------------|------|---------|
| `/api/auth` | `backend/routes/auth.js` | Authentication, user management |
| `/api/propriedades` | `backend/routes/propriedades.js` | Properties and units CRUD |
| `/api/inquilinos` | `backend/routes/inquilinos.js` | Tenant management |
| `/api/contratos` | `backend/routes/contratos.js` | Contracts and installments |
| `/api/dashboard` | `backend/routes/dashboard.js` | Dashboard metrics/KPIs |
| `/api/unidades` | `backend/routes/unidades.js` | Unit listings |
| `/api/relatorios` | `backend/routes/relatorios.js` | PDF reports |

## Error Handling

**Strategy:** Graceful degradation with structured error responses

**Patterns:**
- Backend returns JSON with `error` field: `{ error: 'Error message', code?: 'TOKEN_EXPIRED' }`
- HTTP status codes: 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 409 (conflict), 500 (server error)
- Frontend `request()` function in `frontend/src/lib/api.ts` catches errors and throws Error objects
- Token expiration (401) triggers automatic refresh attempt via `refreshToken()`
- Failed refresh redirects to `/login`

**Transaction Pattern:**
- Database operations use transactions for multi-step operations
- Example: Contract creation in `backend/routes/contratos.js`:
  ```javascript
  const client = await pool.connect();
  try {
      await client.query('BEGIN');
      // ... multiple queries
      await client.query('COMMIT');
  } catch (err) {
      await client.query('ROLLBACK');
      throw err;
  } finally {
      client.release();
  }
  ```

## Cross-Cutting Concerns

**Logging:**
- Backend: Console-based logging via `console.log()` middleware in `backend/server.js`
- Format: `[BACKEND] METHOD /url`
- Frontend: Console logging in API client: `[API] Fetching: url`

**Validation:**
- Backend: Manual validation in route handlers (required fields, UUID format)
- Frontend: HTML5 form validation + custom validation (email regex, password length)

**Authentication:**
- Backend: JWT tokens signed with `JWT_SECRET` and `JWT_REFRESH_SECRET`
- Frontend: Tokens stored in localStorage, attached to all API requests
- Token expiry: Access token 15 minutes, refresh token 7 days

**Security:**
- Password hashing: bcryptjs with 12 rounds
- CORS: Restricted to frontend origin (http://localhost:3000)
- Role checks: `checkRole()` middleware protects admin routes

---

*Architecture analysis: 2026-02-24*
