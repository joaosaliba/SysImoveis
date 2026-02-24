# Conventions

## Code Style

### JavaScript/Node.js (Backend)

#### File Structure
- **Format**: CommonJS modules (`require`/`module.exports`)
- **Location**: `backend/`
- **Entry Point**: `backend/server.js`

#### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | lowercase with dashes | `user-routes.js` |
| Variables | camelCase | `const userName = ...` |
| Functions | camelCase | `function getUser() {}` |
| Constants | UPPER_SNAKE_CASE | `const JWT_SECRET = ...` |
| Classes | PascalCase | `class UserController {}` |

#### Code Organization
```javascript
// 1. Requires (grouped by type)
const express = require('express');
const bcrypt = require('bcryptjs');

// 2. Configuration
const app = express();

// 3. Routes
app.get('/users', getAllUsers);

// 4. Functions/Controllers
async function getAllUsers(req, res) { ... }

// 5. Exports
module.exports = router;
```

#### Error Handling
```javascript
// Use try-catch with async/await
async function getUser(req, res, next) {
  try {
    const user = await db.query('SELECT * FROM users');
    res.json(user);
  } catch (error) {
    next(error); // Pass to error handler
  }
}

// Standardized error responses
res.status(400).json({ error: 'Error message' });
res.status(401).json({ error: 'Unauthorized' });
res.status(404).json({ error: 'Not found' });
res.status(500).json({ error: 'Internal server error' });
```

#### Database Queries
```javascript
// Use parameterized queries to prevent SQL injection
const result = await pool.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

// Return rows directly
return result.rows;
```

### TypeScript (Frontend)

#### File Structure
- **Format**: ES Modules with TypeScript
- **Location**: `frontend/src/`
- **Extensions**: `.tsx` for components, `.ts` for utilities

#### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | PascalCase (components), lowercase (utils) | `Sidebar.tsx`, `utils.ts` |
| Components | PascalCase | `function Combobox() {}` |
| Variables | camelCase | `const userName = ...` |
| Functions | camelCase | `function getUser() {}` |
| Types/Interfaces | PascalCase | `interface UserProps {}` |
| Custom Hooks | camelCase with `use` prefix | `function useAuth() {}` |

#### Component Structure
```tsx
'use client'; // If client component

import { useState } from 'react';

// 1. Types
interface Props {
  name: string;
}

// 2. Component
export function Component({ name }: Props) {
  // Hooks first
  const [state, setState] = useState();

  // Handlers
  const handleClick = () => {};

  // Render
  return <div>{name}</div>;
}
```

#### Next.js App Router Conventions

| Folder/File | Purpose |
|-------------|---------|
| `page.tsx` | Route UI |
| `layout.tsx` | Shared layout |
| `loading.tsx` | Loading UI |
| `error.tsx` | Error boundary |

#### Client vs Server Components
```tsx
// Server Component (default) - no 'use client'
// Used for: Data fetching, SEO, static content
export default async function Page() {
  const data = await fetchData();
  return <div>{data}</div>;
}

// Client Component - requires 'use client'
// Used for: Interactivity, state, effects
'use client';
export function InteractiveComponent() {
  const [state, setState] = useState();
  return <button onClick={() => {}}>{state}</button>;
}
```

## CSS/Styling

### Tailwind CSS v4

#### Class Ordering
Follow logical grouping:
1. Layout (flex, grid, position)
2. Spacing (margins, padding)
3. Sizing (width, height)
4. Typography (font, text)
5. Visuals (colors, borders)
6. Interactive (hover, focus)

#### Component Patterns
```tsx
// Button variant example
<button className="
  px-4 py-2
  bg-blue-600 hover:bg-blue-700
  text-white
  rounded-md
  transition-colors
">
  Click me
</button>
```

## API Conventions

### REST Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/resource` | List all |
| GET | `/api/resource/:id` | Get one |
| POST | `/api/resource` | Create |
| PUT | `/api/resource/:id` | Update |
| DELETE | `/api/resource/:id` | Delete |

### Response Format
```javascript
// Success
{
  "data": [...],
  "total": 10
}

// Error
{
  "error": "Message describing the error"
}
```

### Authentication
```javascript
// Bearer token in Authorization header
Authorization: Bearer <jwt_token>

// Middleware validates and attaches user
req.user = { id: 1, email: 'user@example.com' };
```

## Git Conventions

### Commit Messages
Follow conventional commits:
```
feat: Add new feature
fix: Fix bug
docs: Update documentation
refactor: Code refactoring
chore: Maintenance tasks
```

### Branch Naming
```
feature/feature-name
fix/bug-description
hotfix/critical-fix
```

## Security Conventions

### Password Handling
```javascript
// Always hash before storage
const hashedPassword = await bcrypt.hash(password, 10);

// Compare for authentication
const isValid = await bcrypt.compare(password, hashedPassword);
```

### JWT Implementation
```javascript
// Generate token
const token = jwt.sign({ id, email }, process.env.JWT_SECRET, {
  expiresIn: '1h'
});

// Verify token
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

### SQL Injection Prevention
```javascript
// ✓ Safe - parameterized
pool.query('SELECT * FROM users WHERE email = $1', [email]);

// ✗ Unsafe - string concatenation
pool.query(`SELECT * FROM users WHERE email = '${email}'`);
```
