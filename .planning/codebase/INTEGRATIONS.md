# Integrations

## External Services and APIs

### Database

#### PostgreSQL
- **Connection**: Direct TCP connection via `pg` driver
- **Location**: `backend/db/index.js`
- **Configuration**: `DATABASE_URL` environment variable
- **Connection Pool**: Managed automatically by `pg.Pool`

```javascript
// backend/db/index.js
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```

### Payment Processing

#### Boleto Bancário (Brazilian Payment Slip)
- **Library**: `node-boleto`
- **Purpose**: Generate Brazilian bank payment slips
- **Integration**: Backend boleto generation API
- **Output**: PDF format for download/print

### Authentication

#### JWT (JSON Web Tokens)
- **Library**: `jsonwebtoken`
- **Purpose**: Session management and API authentication
- **Secrets**:
  - `JWT_SECRET` - Access token signing
  - `JWT_REFRESH_SECRET` - Refresh token signing
- **Implementation**: Custom JWT middleware in routes

### File Generation

#### PDFKit
- **Library**: `pdfkit`
- **Purpose**: Custom PDF document generation
- **Use Cases**: Contract documents, reports

## Internal Integrations

### Frontend ↔ Backend

#### API Communication
- **Pattern**: REST API calls
- **Base URL**: Configured per environment
- **Authentication**: JWT Bearer tokens

#### Data Flow
```
Frontend (Next.js) → Express API → PostgreSQL
       ↑                                      ↓
       └────── JWT Auth ──────────────┘
```

### Docker Services

#### Docker Compose
- **File**: `docker-compose.yml`
- **Services**:
  - Backend (Node.js/Express)
  - Frontend (Next.js)
  - PostgreSQL database

## Environment Variables

### Required Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | backend/.env | PostgreSQL connection string |
| `JWT_SECRET` | backend/.env | Access token signing secret |
| `JWT_REFRESH_SECRET` | backend/.env | Refresh token signing secret |
| `ADMIN_NAME` | backend/.env | Default admin user name |
| `ADMIN_EMAIL` | backend/.env | Default admin user email |
| `ADMIN_PASSWORD` | backend/.env | Default admin user password |

## Database Schema

### Core Tables
- `users` - System users with authentication
- `imoveis` - Properties for rental
- `inquilinos` - Tenants
- `contratos` - Rental contracts
- `parcelas` - Payment installments (boleto)

## No External Cloud Services

The application currently runs entirely locally with:
- Local PostgreSQL database
- Local file-based PDF generation
- No external API dependencies for core functionality
- No cloud storage or CDN integration

## Future Integration Points

Potential integrations based on existing architecture:
- Email notifications (contract renewals, payment reminders)
- Online payment gateways (Pix, credit card)
- Cloud storage for documents
- SMS notifications
