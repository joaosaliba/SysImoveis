require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const propriedadesRoutes = require('./routes/propriedades');
const inquilinosRoutes = require('./routes/inquilinos');
const contratosRoutes = require('./routes/contratos');
const dashboardRoutes = require('./routes/dashboard');
const unidadesRoutes = require('./routes/unidades');
const relatoriosRoutes = require('./routes/relatorios');
const perfisRoutes = require('./routes/perfis');
const { initAdmin } = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

// Logger and Audit middlewares
const auditMiddleware = require('./middleware/auditMiddleware');
app.use((req, res, next) => {
    console.log(`[BACKEND] ${req.method} ${req.url}`);
    next();
});
app.use(auditMiddleware);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/propriedades', propriedadesRoutes);
app.use('/api/inquilinos', inquilinosRoutes);
app.use('/api/contratos', contratosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/unidades', unidadesRoutes);
app.use('/api/relatorios', relatoriosRoutes);
app.use('/api/perfis', perfisRoutes);
app.use('/api/auditoria', require('./routes/auditoria'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🏢 GestaoImoveis API running on http://0.0.0.0:${PORT}`);
    await initAdmin();
});
