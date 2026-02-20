# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Application Overview

SysImóveis is a Brazilian rental property management system with a Next.js frontend and Node.js/Express backend. The application manages properties, tenants, contracts, and payment installments with features for generating boletos (Brazilian payment slips).

## Architecture

### Frontend (Next.js 16.1.6)
- Located in `frontend/` directory
- Uses App Router with route groups (`(dashboard)`)
- Main routes: `/login`, `/dashboard`, `/imoveis`, `/inquilinos`, `/contratos`, `/boletos`
- Uses Tailwind CSS for styling with Inter font
- State management via localStorage for authentication tokens
- API communication through `src/lib/api.ts` with automatic token refresh

### Backend (Node.js/Express)
- Located in `backend/` directory
- REST API served at port 3001
- PostgreSQL database with UUID primary keys
- Authentication with JWT tokens (access + refresh tokens)
- CORS configured for localhost:3000

### Database Schema
- `usuarios`: User authentication table
- `propriedades`: Properties/buildings with addresses
- `unidades`: Units (apartments, stores, etc.) linked to properties
- `inquilinos`: Tenants with CPF identification
- `contratos`: Rental contracts linking tenants to units
- `contrato_parcelas`: Payment installments for contracts

## Development Commands

### Frontend
- `cd frontend && npm run dev` - Start development server (port 3000)
- `cd frontend && npm run build` - Build for production
- `cd frontend && npm run start` - Start production server
- `cd frontend && npm run lint` - Run ESLint

### Backend
- `cd backend && npm run dev` - Start development server (port 3001)
- `cd backend && npm start` - Start production server

### Full Stack (Docker)
- `docker-compose up` - Start entire stack (DB on 5433, backend on 3001, frontend on 3000)
- `docker-compose down` - Stop all services

## Key Components

### Frontend Components
- `Sidebar.tsx` - Navigation sidebar
- `ContractDetailModal.tsx` - Contract details modal
- `ParcelaModal.tsx` - Payment installment modal
- `BulkActionModal.tsx` - Bulk action modal
- `InstallmentGenerationModal.tsx` - Installment generation modal

### Backend Routes
- `/api/auth/*` - Authentication (login, register, refresh)
- `/api/propriedades/*` - Property management
- `/api/inquilinos/*` - Tenant management
- `/api/contratos/*` - Contract management
- `/api/unidades/*` - Unit management
- `/api/dashboard/*` - Dashboard statistics

## Environment Variables

### Backend
- `PORT` - Server port (default: 3001)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Access token secret
- `JWT_REFRESH_SECRET` - Refresh token secret

### Frontend
- `BACKEND_URL` - Backend API URL (used in Docker setup)

## Authentication Flow

1. Login via `/api/auth/login` endpoint
2. Tokens stored in localStorage (`accessToken`, `refreshToken`)
3. API requests include Authorization header with Bearer token
4. 401 responses with TOKEN_EXPIRED trigger automatic refresh
5. Logout clears localStorage and redirects to `/login`

## Special Considerations

- The application handles Brazilian document formats (CPF, RG)
- Currency values use Brazilian decimal format (comma as decimal separator)
- Date formats follow Brazilian conventions (DD/MM/YYYY)
- The application generates boletos (Brazilian payment slips)
- Database uses PostgreSQL with UUID primary keys and JSONB for phone numbers