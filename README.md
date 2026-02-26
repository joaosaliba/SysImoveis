# SysImóveis - Sistema de Gestão de Imóveis

Sistema completo para gestão de propriedades, inquilinos, contratos e boletos de aluguel.

## 🏗️ Arquitetura do Projeto

```
GestaoImoveis/
├── backend/                 # API Node.js + Express
│   ├── db/                 # Configuração do banco e migrations
│   ├── middleware/         # Middlewares (auth, roles)
│   ├── routes/             # Rotas da API
│   └── server.js           # Entry point
├── frontend/               # Next.js 16 + React 19 + TypeScript
│   ├── src/
│   │   ├── app/           # Páginas (App Router)
│   │   ├── components/    # Componentes React
│   │   └── lib/           # Utilitários e API client
│   └── public/            # Assets estáticos
└── docker-compose.yml      # Orquestração Docker
```

### Stack Tecnológico

**Backend:**
- Node.js + Express
- PostgreSQL
- JWT (autenticação)
- bcryptjs (hash de senha)
- pdfkit (geração de relatórios PDF)
- node-boleto (geração de boletos bancários)

**Frontend:**
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4

---

## 🚀 Como Rodar

### Com Docker (Recomendado)

```bash
# Iniciar todos os serviços
docker-compose up -d

# O sistema estará disponível em:
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
# PostgreSQL: localhost:5432
```

### Localmente

#### Pré-requisitos
- Node.js 18+
- PostgreSQL 14+
- npm ou yarn

#### Backend

```bash
cd backend

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações do banco

# Rodar migrations (criar tabelas)
psql -U seu_usuario -d gestao_imoveis -f db/schema.sql

# Iniciar servidor (desenvolvimento)
npm run dev

# Ou produção
npm start
```

#### Frontend

```bash
cd frontend

# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Build de produção
npm run build
npm start
```

---

## 🔐 Variáveis de Ambiente

### Backend (.env)

```env
# Servidor
PORT=3001

# Banco de Dados
DATABASE_URL=postgresql://user:password@localhost:5432/gestao_imoveis

# JWT
JWT_SECRET=sua_chave_secreta_muito_forte
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=sua_chave_refresh_secreta
JWT_REFRESH_EXPIRES_IN=7d

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend (.env.local)

```env
# URL da API Backend
BACKEND_URL=http://localhost:3001
```

---

## 📋 Sistema de Roles (Permissões)

O sistema possui 3 níveis de acesso:

| Role | Permissões |
|------|-----------|
| `admin` | Acesso total: gerencia usuários, roles, e todos os módulos |
| `gestor` | Gerencia propriedades, inquilinos, contratos e boletos |
| `inquilino` | Apenas visualização de contratos e boletos |

### Rotas Protegidas

- `/api/auth/users/*` - Apenas **admin**
- `/usuarios` (frontend) - Apenas **admin**
- Demais rotas - **admin** e **gestor**

---

## 📡 Endpoints da API

### Autenticação

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| POST | `/api/auth/register` | Registrar novo usuário | ❌ |
| POST | `/api/auth/login` | Login | ❌ |
| POST | `/api/auth/refresh` | Refresh token | ❌ |
| GET | `/api/auth/users` | Listar usuários | ✅ Admin |
| PUT | `/api/auth/users/:id/role` | Alterar role | ✅ Admin |
| DELETE | `/api/auth/users/:id` | Remover usuário | ✅ Admin |

### Propriedades

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/api/propriedades` | Listar propriedades (paginado) | ✅ |
| GET | `/api/propriedades/:id` | Buscar propriedade | ✅ |
| POST | `/api/propriedades` | Criar propriedade | ✅ |
| PUT | `/api/propriedades/:id` | Atualizar propriedade | ✅ |
| DELETE | `/api/propriedades/:id` | Remover propriedade | ✅ |
| GET | `/api/propriedades/:id/unidades` | Listar unidades | ✅ |
| POST | `/api/propriedades/:id/unidades` | Criar unidade | ✅ |
| PUT | `/api/propriedades/unidades/:id` | Atualizar unidade | ✅ |
| DELETE | `/api/propriedades/unidades/:id` | Remover unidade | ✅ |
| GET | `/api/unidades` | Listar todas as unidades (paginado) | ✅ |
| GET | `/api/propriedades/unidades/all` | Listar todas as unidades (global/seletor) | ✅ |

### Inquilinos

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/api/inquilinos` | Listar inquilinos (paginado) | ✅ |
| GET | `/api/inquilinos/:id` | Buscar inquilino | ✅ |
| POST | `/api/inquilinos` | Criar inquilino | ✅ |
| PUT | `/api/inquilinos/:id` | Atualizar inquilino | ✅ |
| DELETE | `/api/inquilinos/:id` | Remover inquilino | ✅ |

### Contratos

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/api/contratos` | Listar contratos (paginado) | ✅ |
| GET | `/api/contratos/:id` | Buscar contrato | ✅ |
| POST | `/api/contratos` | Criar contrato | ✅ |
| PUT | `/api/contratos/:id` | Atualizar contrato | ✅ |
| DELETE | `/api/contratos/:id` | Remover contrato | ✅ |
| POST | `/api/contratos/:id/renovar` | Renovar contrato | ✅ |
| PATCH | `/api/contratos/:id/encerrar` | Encerrar contrato | ✅ |
| GET | `/api/contratos/:id/parcelas` | Listar parcelas | ✅ |
| POST | `/api/contratos/parcelas/avulso` | Criar parcela avulsa | ✅ |
| PATCH | `/api/contratos/parcelas/:id` | Atualizar parcela | ✅ |
| GET | `/api/contratos/parcelas/filtro` | Listar boletos com filtros avançados | ✅ |
| POST | `/api/contratos/parcelas/bulk-update` | Atualização em massa de status | ✅ |
| POST | `/api/contratos/:id/parcelas/gerar` | Geração manual/automática de parcelas | ✅ |
| GET | `/api/contratos/parcelas/:id/boleto` | Imprimir boleto individual (HTML) | ✅ |
| GET | `/api/contratos/parcelas/bulk/boletos` | Imprimir boletos em massa (HTML) | ✅ |
| GET | `/api/contratos/parcelas/bulk/pdf` | Baixar boletos em massa (PDF) | ✅ |

### Dashboard

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/api/dashboard` | Métricas gerais | ✅ |
| GET | `/api/dashboard/ocupacao` | Taxa de ocupação | ✅ |
| GET | `/api/dashboard/receita-mensal` | Receita dos últimos 12 meses | ✅ |
| GET | `/api/dashboard/contratos-status` | Contratos por status | ✅ |
| GET | `/api/dashboard/receita-por-imovel` | Receita por imóvel (top 10) | ✅ |

### Relatórios PDF

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/api/relatorios/contrato/:id` | Baixar PDF do contrato | ✅ |
| GET | `/api/relatorios/boleto/:id` | Baixar PDF do boleto (Legado) | ✅ |

---

## ✨ Funcionalidades em Destaque

### 💸 Central de Boletos
Interface centralizada para gestão financeira com:
- **Filtros Avançados**: Busca por período, status, imóvel ou inquilino.
- **Ações em Massa**: Seleção múltipla para atualização de status (pago, pendente, etc).
- **Impressão Inteligente**: Geração de boletos em HTML (ideal para impressão rápida) ou PDF agrupado.

### 📝 Gestão de Contratos
- **Automação**: Geração automática de parcelas no momento da criação.
- **Flexibilidade**: Possibilidade de criar cobranças avulsas fora do ciclo normal.
- **Renovação**: Fluxo simplificado para renovação de contratos com histórico.

---

## 🧪 Primeiros Passos

### 1. Criar Usuário Admin

Após iniciar o banco, execute o migration de roles e crie um admin:

```sql
-- Rodar migration de roles
\i backend/db/migrations/001_add_roles.sql

-- Criar primeiro admin (senha será hash no backend)
INSERT INTO usuarios (nome, email, senha_hash, role) 
VALUES ('Administrador', 'admin@sysimoveis.com', '$2a$12$...', 'admin');
```

Ou use a API de registro e atualize o role via SQL:

```sql
UPDATE usuarios SET role = 'admin' WHERE email = 'seu@email.com';
```

### 2. Acessar o Sistema

1. Acesse `http://localhost:3000/login`
2. Use as credenciais do usuário admin
3. O menu "Usuários" aparecerá apenas para admins

---

## 📁 Estrutura do Banco de Dados

### Principais Tabelas

- `usuarios` - Usuários do sistema (admin, gestor, inquilino)
- `propriedades` - Imóveis/edifícios
- `unidades` - Apartamentos, lojas, salas
- `inquilinos` - Dados dos inquilinos
- `contratos` - Contratos de locação
- `contrato_parcelas` - Parcelas/boletos dos contratos
- `contrato_renovacoes` - Histórico de renovações

---

## 🛠️ Desenvolvimento

### Scripts Úteis

**Backend:**
```bash
npm run dev      # Desenvolvimento com auto-reload
npm start        # Produção
```

**Frontend:**
```bash
npm run dev      # Desenvolvimento (porta 3000)
npm run build    # Build de produção
npm start        # Produção
npm run lint     # ESLint
```

---

## 📝 Licença

MIT

---

## 👥 Fluxo Saas
```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant DB

    Note over User,DB: New Organization Registration
    User->>Frontend: Fills signup form
    Frontend->>API: POST /api/auth/signup
    API->>DB: INSERT organizacoes + usuarios
    API-->>Frontend: 201 Created

    Note over User,DB: Login & Tenant Resolution
    User->>Frontend: Login with email/password
    Frontend->>API: POST /api/auth/login
    API->>DB: SELECT user + org
    API-->>Frontend: JWT with organizacao_id
    
    Note over User,DB: Data Isolation
    Frontend->>API: GET /api/propriedades (Bearer JWT)
    API->>API: verifyToken → tenantMiddleware
    API->>DB: WHERE organizacao_id = $org_id
    DB-->>API: Org-scoped rows only
```