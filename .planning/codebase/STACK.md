# Tech Stack

## Overview

This is a full-stack property rental management system (Gestão de Imóveis) with a Node.js backend and Next.js frontend.

## Backend

### Runtime
- **Node.js** - JavaScript runtime

### Framework
- **Express** ^4.21.2 - Web application framework

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| bcryptjs | ^2.4.3 | Password hashing |
| cors | ^2.8.5 | Cross-origin resource sharing |
| dotenv | ^16.4.7 | Environment variables |
| express | ^4.21.2 | Web framework |
| jsonwebtoken | ^9.0.2 | JWT authentication |
| moment | ^2.30.1 | Date manipulation |
| node-boleto | ^2.3.0 | Brazilian boleto generation |
| pdfkit | ^0.17.2 | PDF generation |
| pg | ^8.13.1 | PostgreSQL client |

### Database
- **PostgreSQL** - Primary database
- Connection via `pg` driver with connection pooling

### Authentication
- **JWT** (jsonwebtoken) for session management
- **bcryptjs** for password hashing

### PDF/Boleto Generation
- **node-boleto** - Brazilian payment slip generation
- **pdfkit** - Custom PDF document generation

## Frontend

### Framework
- **Next.js** 16.1.6 - React framework with App Router
- **React** 19.2.3 - UI library

### Styling
- **Tailwind CSS** v4 - Utility-first CSS framework
- **PostCSS** - CSS preprocessing

### UI Components
- **lucide-react** ^0.574.0 - Icon library
- Custom components in `src/components/`

### Data Visualization
- **chart.js** ^4.5.1 - Charting library
- **react-chartjs-2** ^5.3.1 - React wrapper for Chart.js

### Utilities
- **date-fns** ^4.1.0 - Date manipulation

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| @tailwindcss/postcss | ^4 | Tailwind CSS integration |
| @types/node | ^20 | Node.js type definitions |
| @types/react | ^19 | React type definitions |
| @types/react-dom | ^19 | ReactDOM type definitions |
| babel-plugin-react-compiler | 1.0.0 | React compiler |
| eslint | ^9 | Linting |
| eslint-config-next | 16.1.6 | Next.js ESLint config |
| tailwindcss | ^4 | Tailwind CSS |
| typescript | ^5 | TypeScript |

### TypeScript
- Full TypeScript support with strict typing

## Configuration Files

### Backend
- `backend/.env` - Environment variables (database, JWT secrets)
- `backend/.env.example` - Template for environment setup
- `docker-compose.yml` - Docker services orchestration

### Frontend
- `frontend/eslint.config.mjs` - ESLint configuration
- `frontend/postcss.config.mjs` - PostCSS configuration
- `frontend/next.config.ts` - Next.js configuration

## Scripts

### Backend
```bash
npm start    # Production server
npm run dev  # Development server with auto-reload
```

### Frontend
```bash
npm run dev   # Development server
npm run build # Production build
npm run start # Production server
npm run lint  # ESLint
```

## Browser Support

```json
[
  ">0.2%",
  "last 4 versions",
  "not dead",
  "not op_mini all",
  "ie 11"
]
```
