# Plano de Implementação - Fase 1 (2 semanas)

## Tarefas

### 1. Implementar Paginação
- [x] Backend: Criar utilitário de paginação em `db/pagination.js`
- [x] Backend: Adicionar paginação na rota `/api/propriedades`
- [x] Backend: Adicionar paginação na rota `/api/inquilinos`
- [x] Backend: Adicionar paginação na rota `/api/contratos`
- [x] Backend: Adicionar paginação na rota `/api/unidades`
- [x] Frontend: Componente `Pagination.tsx` já existe em `components/ui/`
- [x] Frontend: Integrar paginação em Inquilinos
- [x] Frontend: Integrar paginação em Contratos
- [x] Frontend: Integrar paginação em Propriedades/Imóveis
- [x] Frontend: Integrar paginação em Unidades (via Imóveis)

### 2. Sistema de Roles
- [x] Backend: Adicionar coluna `role` no banco (admin, gestor, inquilino)
- [x] Backend: Criar middleware `checkRole` em `middleware/auth.js`
- [x] Backend: Proteger rotas sensíveis com verificação de role
- [x] Backend: Atualizar registro de usuário para definir role padrão
- [x] Backend: Adicionar rotas de gestão de usuários (admin)
- [x] Frontend: Armazenar role no contexto de autenticação
- [x] Frontend: Criar componente `RequireRole` para proteção de rotas
- [x] Frontend: Condicionar botões/ações por role (Sidebar condicional)
- [x] Frontend: Página de gestão de usuários (apenas admin)

### 3. Dashboard com Gráficos
- [x] Backend: Expandir `/api/dashboard` com métricas de ocupação
- [x] Backend: Adicionar endpoint de receita mensal
- [x] Backend: Adicionar endpoint de contratos por status
- [x] Frontend: Instalar biblioteca de gráficos (chart.js + react-chartjs-2)
- [x] Frontend: Criar cards de KPIs no Dashboard
- [x] Frontend: Implementar gráfico de ocupação vs. vacância (Pie)
- [x] Frontend: Implementar gráfico de receita mensal (Line)
- [x] Frontend: Implementar gráfico de contratos por status (Bar)

### 4. Relatórios PDF
- [x] Backend: Instalar `pdfkit`
- [x] Backend: Criar serviço de geração de PDF em `services/pdfService.js`
- [x] Backend: Criar rota `/api/relatorios/contrato/:id`
- [x] Backend: Criar rota `/api/relatorios/boleto/:id`
- [x] Frontend: Botão "Baixar PDF do Contrato" em Contratos
- [x] Frontend: Botão "Baixar Boleto PDF" em Boletos

### 5. Preencher README
- [x] Documentar arquitetura do projeto
- [x] Documentar como rodar com Docker
- [x] Documentar como rodar localmente
- [x] Listar variáveis de ambiente necessárias
- [x] Documentar endpoints da API
- [x] Adicionar screenshots do sistema (opcional - pode ser feito posteriormente)

---

## Progresso

| Tarefa | Status | Conclusão |
|--------|--------|-----------|
| 1. Paginação | ✅ Concluída | 10/10 |
| 2. Sistema de Roles | ✅ Concluída | 9/9 |
| 3. Dashboard com Gráficos | ✅ Concluída | 8/8 |
| 4. Relatórios PDF | ✅ Concluída | 6/6 |
| 5. README | ✅ Concluída | 6/6 |

**Total Geral:** 39/39 tarefas concluídas ✅

---

## Resumo da Implementação

### ✅ Funcionalidades Implementadas

**1. Paginação**
- Backend: Utilitário `db/pagination.js` com `getPaginationParams` e `formatPaginatedResponse`
- Rotas atualizadas: `/propriedades`, `/inquilinos`, `/contratos`, `/unidades`
- Frontend: Componente `Pagination.tsx` atualizado com seletor de itens por página
- Páginas integradas: Inquilinos, Contratos, Imóveis

**2. Sistema de Roles**
- Migration `001_add_roles.sql` para adicionar coluna `role` na tabela `usuarios`
- Middleware `checkRole()` e `isAdmin()` em `middleware/auth.js`
- Rotas de gestão de usuários (apenas admin): `GET/PUT/DELETE /api/auth/users/*`
- Frontend: Funções `getUserRole()`, `hasRole()`, `isAdmin()`, `isGestor()`
- Componente `RequireRole.tsx` e hook `useRole()`
- Página de gestão de usuários `/usuarios` (apenas admin)
- Sidebar com menu condicional para admin

**3. Dashboard com Gráficos**
- Backend: Novos endpoints `/dashboard/ocupacao`, `/receita-mensal`, `/contratos-status`, `/receita-por-imovel`
- Frontend: Instalação de `chart.js` e `react-chartjs-2`
- Gráficos implementados:
  - Pie Chart: Ocupação das Unidades (Alugadas, Disponíveis, Manutenção)
  - Bar Chart: Status dos Contratos (Ativo, Vence em breve, Vencido, Encerrado)
  - Line Chart: Receita Mensal (últimos 12 meses)

**4. Relatórios PDF**
- Backend: `pdfkit` instalado
- Serviço `services/pdfService.js` com `generateContratoPDF` e `generateBoletoPDF`
- Rotas `/api/relatorios/contrato/:id` e `/api/relatorios/boleto/:id`
- Frontend: Botões de download em Contratos e Boletos

**5. README**
- Documentação completa da arquitetura
- Instruções Docker e local
- Variáveis de ambiente
- Todos os endpoints da API
- Sistema de roles documentado

---

## Cronograma

| Semana | Período | Foco |
|--------|---------|------|
| Semana 1 | Dia 1-5 | Paginação + Sistema de Roles |
| Semana 2 | Dia 6-10 | Dashboard + PDF + README |

---

## Dependências a Instalar

### Backend
```bash
npm install pdfkit
```

### Frontend
```bash
npm install chart.js react-chartjs-2
```
