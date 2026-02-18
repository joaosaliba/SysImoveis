require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const propriedadesRoutes = require('./routes/propriedades');
const inquilinosRoutes = require('./routes/inquilinos');
const contratosRoutes = require('./routes/contratos');
const dashboardRoutes = require('./routes/dashboard');
const unidadesRoutes = require('./routes/unidades');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
    console.log(`[BACKEND] ${req.method} ${req.url}`);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/propriedades', propriedadesRoutes);
app.use('/api/inquilinos', inquilinosRoutes);
app.use('/api/contratos', contratosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/unidades', unidadesRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏢 GestaoImoveis API running on http://0.0.0.0:${PORT}`);
});
