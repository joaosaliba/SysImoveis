# Testing

## Current State

**No test files found in the codebase.**

The project currently does not have:
- Unit tests
- Integration tests
- End-to-end tests
- Test configuration files

## Recommended Testing Strategy

### Backend Testing

#### Framework Recommendation: Jest

**Installation:**
```bash
cd backend
npm install --save-dev jest supertest
```

**Configuration (`backend/jest.config.js`):**
```javascript
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: ['**/*.js'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

**Example Test (`backend/tests/user.test.js`):**
```javascript
const request = require('supertest');
const app = require('../server');

describe('User Routes', () => {
  describe('GET /users', () => {
    it('should return all users', async () => {
      const res = await request(app).get('/users');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /users', () => {
    it('should create a new user', async () => {
      const res = await request(app)
        .post('/users')
        .send({ name: 'Test', email: 'test@test.com' });
      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('Test');
    });
  });
});
```

#### Database Testing

**Mock pool approach:**
```javascript
// __mocks__/pg.js
const mockPool = {
  query: jest.fn(),
};

module.exports = {
  Pool: jest.fn().mockImplementation(() => mockPool),
};
```

**Test with mocked database:**
```javascript
jest.mock('../db/index');
const pool = require('../db/index');

describe('User Service', () => {
  it('should fetch user by id', async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 1, name: 'Test' }]
    });

    const result = await getUserById(1);
    expect(result.name).toBe('Test');
  });
});
```

### Frontend Testing

#### Framework Recommendation: Jest + React Testing Library

**Already included via `eslint-config-next`**

**Installation (if needed):**
```bash
cd frontend
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Configuration (`frontend/jest.config.js`):**
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
};
```

**Setup (`frontend/jest.setup.js`):**
```javascript
import '@testing-library/jest-dom';
```

**Example Component Test (`frontend/src/components/__tests__/Sidebar.test.tsx`):**
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from '../Sidebar';

describe('Sidebar', () => {
  it('renders navigation links', () => {
    render(<Sidebar />);
    expect(screen.getByText('Imóveis')).toBeInTheDocument();
    expect(screen.getByText('Inquilinos')).toBeInTheDocument();
    expect(screen.getByText('Contratos')).toBeInTheDocument();
  });

  it('handles navigation click', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByText('Imóveis'));
    // Assert navigation behavior
  });
});
```

#### Hook Testing

```tsx
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';

describe('useAuth', () => {
  it('should initialize with null user', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
  });

  it('should login user', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login({ email: 'test@test.com', password: '123' });
    });

    expect(result.current.user).toEqual({ email: 'test@test.com' });
  });
});
```

### Integration Testing

#### API Integration Tests

```javascript
// backend/tests/integration/auth.test.js
describe('Authentication Flow', () => {
  let authToken;

  it('should register user', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        name: 'Test User',
        email: 'test@test.com',
        password: 'password123'
      });
    expect(res.statusCode).toBe(201);
  });

  it('should login user', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@test.com',
        password: 'password123'
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    authToken = res.body.token;
  });

  it('should access protected route with token', async () => {
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
  });
});
```

### End-to-End Testing

#### Recommendation: Playwright or Cypress

**Playwright Installation:**
```bash
npm install --save-dev @playwright/test
npx playwright install
```

**Example E2E Test (`e2e/login.spec.ts`):**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'admin@admin.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'invalid@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });
});
```

## Test Scripts

### Add to `backend/package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### Add to `frontend/package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Test File Organization

```
backend/
  src/
    routes/
    services/
    models/
  tests/
    unit/
    integration/
    fixtures/

frontend/
  src/
    components/
      __tests__/
    app/
      __tests__/
    hooks/
      __tests__/
    utils/
      __tests__/
```

## Mocking Patterns

### External Dependencies

```javascript
// Mock node-boleto
jest.mock('node-boleto', () => ({
  Boleto: class MockBoleto {
    validate() { return { valid: true }; }
    generateBarcode() { return '1234567890'; }
  }
}));

// Mock pdfkit
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => ({
    text: jest.fn().mockReturnThis(),
    end: jest.fn(),
    on: jest.fn().mockReturnThis()
  }));
});
```

### Environment Variables

```javascript
// Set test environment variables
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgresql://localhost:5432/test_db';
```

## Coverage Goals

| Category | Target |
|----------|--------|
| Backend Unit Tests | 80% |
| Backend Integration | Critical paths |
| Frontend Components | 70% |
| E2E Critical Flows | Login, CRUD operations |
