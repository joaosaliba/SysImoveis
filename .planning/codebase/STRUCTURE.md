# Codebase Structure

**Analysis Date:** 2026-02-24

## Directory Layout

```
GestaoImoveis/
├── backend/                    # Node.js Express API
│   ├── db/                     # Database configuration and utilities
│   │   ├── pool.js             # PostgreSQL connection pool
│   │   ├── pagination.js       # Pagination utilities
│   │   ├── schema.sql          # Database schema/migrations
│   │   └── seed.js             # Initial data seeding (admin user)
│   ├── middleware/             # Express middleware
│   │   └── auth.js             # JWT verification, role checking
│   ├── routes/                 # API route handlers
│   │   ├── auth.js             # Authentication endpoints
│   │   ├── contratos.js        # Contracts and installments
│   │   ├── dashboard.js        # Dashboard metrics
│   │   ├── inquilinos.js       # Tenant management
│   │   ├── propriedades.js     # Properties and units
│   │   ├── relatorios.js       # PDF reports
│   │   └── unidades.js         # Unit listings
│   ├── services/               # Business logic services
│   │   └── pdfService.js       # PDF generation utilities
│   ├── temp/                   # Temporary files (generated PDFs)
│   ├── package.json            # Backend dependencies
│   └── server.js               # Express app entry point
├── frontend/                   # Next.js 16 Application
│   ├── src/
│   │   ├── app/                # Next.js App Router pages
│   │   │   ├── (dashboard)/    # Protected dashboard pages (route group)
│   │   │   │   ├── boletos/    # Installments/boletos management
│   │   │   │   ├── contratos/  # Contract management
│   │   │   │   ├── dashboard/  # Main dashboard
│   │   │   │   ├── imoveis/    # Property management
│   │   │   │   ├── inquilinos/ # Tenant management
│   │   │   │   └── usuarios/   # User management (admin only)
│   │   │   ├── login/          # Login page
│   │   │   ├── globals.css     # Global styles (Tailwind)
│   │   │   ├── layout.tsx      # Root layout
│   │   │   └── page.tsx        # Home redirect page
│   │   ├── components/         # React components
│   │   │   ├── ui/             # Reusable UI components
│   │   │   │   ├── AlertModal.tsx
│   │   │   │   ├── Combobox.tsx
│   │   │   │   ├── ConfirmModal.tsx
│   │   │   │   └── Pagination.tsx
│   │   │   ├── BulkActionModal.tsx      # Bulk operations modal
│   │   │   ├── ContractDetailModal.tsx  # Contract details
│   │   │   ├── InstallmentGenerationModal.tsx
│   │   │   ├── ParcelaModal.tsx         # Installment form
│   │   │   ├── RequireRole.tsx          # Role-based access
│   │   │   └── Sidebar.tsx              # Navigation sidebar
│   │   └── lib/                # Utilities and helpers
│   │       ├── api.ts          # API client with auth
│   │       └── masks.ts        # Input masks (CEP, etc.)
│   ├── public/                 # Static assets
│   ├── package.json            # Frontend dependencies
│   └── next.config.ts          # Next.js configuration
├── docker-compose.yml          # Docker orchestration
├── README.md                   # Project documentation
└── .planning/codebase/         # Codebase analysis documents
```

## Directory Purposes

**`backend/db/`:**
- Purpose: Database connection and shared utilities
- Contains: Connection pool singleton, pagination helpers, schema definitions
- Key files: `backend/db/pool.js`, `backend/db/pagination.js`, `backend/db/schema.sql`

**`backend/middleware/`:**
- Purpose: Express middleware for cross-cutting concerns
- Contains: Authentication verification, role-based access control
- Key files: `backend/middleware/auth.js`

**`backend/routes/`:**
- Purpose: API endpoint handlers organized by domain
- Contains: REST controllers for each entity type
- Key files: `backend/routes/auth.js`, `backend/routes/contratos.js`, `backend/routes/propriedades.js`

**`backend/services/`:**
- Purpose: Business logic extracted from routes
- Contains: PDF generation, external service integrations
- Key files: `backend/services/pdfService.js`

**`frontend/src/app/`:**
- Purpose: Next.js App Router pages and layouts
- Contains: Route definitions, page components, global layout
- Key files: `frontend/src/app/layout.tsx`, `frontend/src/app/(dashboard)/layout.tsx`

**`frontend/src/components/`:**
- Purpose: Reusable React components
- Contains: UI components, feature-specific modals, navigation
- Key files: `frontend/src/components/Sidebar.tsx`, `frontend/src/components/ParcelaModal.tsx`

**`frontend/src/components/ui/`:**
- Purpose: Generic UI building blocks
- Contains: Modals, pagination, form controls
- Key files: `frontend/src/components/ui/Combobox.tsx`, `frontend/src/components/ui/Pagination.tsx`

**`frontend/src/lib/`:**
- Purpose: Shared utilities and API client
- Contains: HTTP client, input masks, helper functions
- Key files: `frontend/src/lib/api.ts`, `frontend/src/lib/masks.ts`

## Key File Locations

**Entry Points:**
- `backend/server.js`: Express server startup
- `frontend/src/app/layout.tsx`: Root HTML layout
- `frontend/src/app/page.tsx`: Home page (redirects to dashboard/login)
- `frontend/src/app/login/page.tsx`: Login page

**Configuration:**
- `backend/package.json`: Backend dependencies
- `frontend/package.json`: Frontend dependencies
- `docker-compose.yml`: Container orchestration
- `backend/db/schema.sql`: Database schema

**Core Logic:**
- `backend/routes/contratos.js`: Contract and installment management
- `backend/routes/auth.js`: Authentication and user management
- `frontend/src/lib/api.ts`: API client with token handling

**Authentication:**
- `backend/middleware/auth.js`: JWT verification middleware
- `frontend/src/lib/api.ts`: Token storage and refresh logic
- `frontend/src/components/RequireRole.tsx`: Client-side role checks

**Testing:**
- Not detected (no test files present in codebase)

## Naming Conventions

**Files:**
- Backend: `kebab-case.js` (e.g., `auth.js`, `propriedades.js`)
- Frontend: `PascalCase.tsx` for components (e.g., `Sidebar.tsx`, `ParcelaModal.tsx`)
- Pages: `page.tsx` (Next.js convention)
- Layouts: `layout.tsx` (Next.js convention)

**Directories:**
- Lowercase kebab-case: `backend/routes/`, `frontend/src/components/`
- Route groups: `(dashboard)` for grouping without URL segment

**Functions:**
- Backend: `camelCase` (e.g., `generateParcelas()`, `getPaginationParams()`)
- Frontend: `camelCase` for functions, `PascalCase` for components

**Variables:**
- `camelCase` throughout (e.g., `valorInicial`, `dataVencimento`)

**Database:**
- Tables: `snake_case` plural (e.g., `usuarios`, `contratos`, `contrato_parcelas`)
- Columns: `snake_case` (e.g., `data_inicio`, `valor_inicial`)

## Where to Add New Code

**New Feature (e.g., "Notificações"):**
- Backend routes: `backend/routes/notificacoes.js`
- Backend: Register in `backend/server.js`
- Frontend page: `frontend/src/app/(dashboard)/notificacoes/page.tsx`
- Frontend components: `frontend/src/components/NotificacaoModal.tsx`
- API methods: Add to `frontend/src/lib/api.ts`

**New API Endpoint:**
- Add route handler in appropriate file in `backend/routes/`
- Or create new route file and register in `backend/server.js`
- Example pattern in `backend/routes/auth.js`:
  ```javascript
  router.post('/login', async (req, res) => { ... });
  ```

**New Component:**
- Reusable UI: `frontend/src/components/ui/ComponentName.tsx`
- Feature-specific: `frontend/src/components/FeatureModal.tsx`
- Page-specific: Can also place alongside page in `frontend/src/app/(dashboard)/feature/`

**New Database Table:**
- Add CREATE TABLE to `backend/db/schema.sql`
- Add index definitions after table
- Update seed data if needed in `backend/db/seed.js`

**Utilities/Helpers:**
- Shared functions: `frontend/src/lib/utils.ts`
- Input masks: `frontend/src/lib/masks.ts`
- API helpers: `frontend/src/lib/api.ts`

## Special Directories

**`frontend/src/app/(dashboard)/`:**
- Purpose: Route group for protected pages (doesn't create URL segment)
- Contents: All authenticated user pages
- Generated: No
- Committed: Yes

**`frontend/.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes (via `npm run build`)
- Committed: No (in .gitignore)

**`backend/node_modules/` and `frontend/node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (via `npm install`)
- Committed: No (in .gitignore)

**`backend/temp/`:**
- Purpose: Temporary storage for generated PDFs
- Generated: Yes (at runtime)
- Committed: No

**`backend/db/migrations/`:**
- Purpose: Database migration scripts
- Example: `backend/db/migrations/001_add_roles.sql`
- Committed: Yes

---

*Structure analysis: 2026-02-24*
