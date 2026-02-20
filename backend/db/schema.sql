-- =============================================
-- GestaoImoveis - Database Schema (SaaS / Multi-tenant)
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Realms (Tenants)
CREATE TABLE IF NOT EXISTS realms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usuarios (Authentication)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    realm_id UUID NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    role VARCHAR(20) DEFAULT 'gestor' CHECK (role IN ('admin', 'gestor', 'inquilino')),
    is_master BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON usuarios(role);
CREATE INDEX IF NOT EXISTS idx_usuarios_realm ON usuarios(realm_id);

-- Propriedades (Imóveis / Edifícios)
CREATE TABLE IF NOT EXISTS propriedades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    realm_id UUID NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
    nome VARCHAR(255),
    endereco VARCHAR(500) NOT NULL,
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(150),
    cidade VARCHAR(150) NOT NULL,
    uf CHAR(2) NOT NULL,
    cep VARCHAR(10),
    administrador VARCHAR(255),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unidades (Apartamentos, Lojas, Salas, etc.)
CREATE TABLE IF NOT EXISTS unidades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    realm_id UUID NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
    propriedade_id UUID NOT NULL REFERENCES propriedades(id) ON DELETE CASCADE,
    identificador VARCHAR(50) NOT NULL,
    tipo_unidade VARCHAR(50) NOT NULL CHECK (tipo_unidade IN ('Apartamento', 'Loja', 'Sala Comercial', 'Casa', 'Kitnet', 'Galpão', 'Sobrado', 'Outro')),
    area_m2 NUMERIC(10, 2),
    valor_sugerido NUMERIC(12, 2),
    observacoes TEXT,
    status VARCHAR(30) DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'alugado', 'manutencao', 'inativo')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inquilinos
CREATE TABLE IF NOT EXISTS inquilinos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    realm_id UUID NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
    cpf VARCHAR(14) NOT NULL, -- Remark: removed UNIQUE to allow same CPF in different realms if needed, or keep UNIQUE global. Requirements usually imply per realm or global. Multi-tenant usually means data isolation. Let's make it UNIQUE per realm.
    nome_completo VARCHAR(255) NOT NULL,
    rg VARCHAR(20),
    orgao_emissor VARCHAR(20),
    uf_rg CHAR(2),
    telefones JSONB DEFAULT '[]',
    email VARCHAR(255),
    observacoes TEXT,
    restricoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(realm_id, cpf)
);

-- Contratos
CREATE TABLE IF NOT EXISTS contratos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    realm_id UUID NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
    inquilino_id UUID NOT NULL REFERENCES inquilinos(id) ON DELETE RESTRICT,
    unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE RESTRICT,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    qtd_ocupantes INTEGER DEFAULT 1,
    valor_inicial NUMERIC(12, 2) NOT NULL,
    dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    valor_iptu NUMERIC(12, 2) DEFAULT 0,
    valor_agua NUMERIC(12, 2) DEFAULT 0,
    valor_luz NUMERIC(12, 2) DEFAULT 0,
    valor_outros NUMERIC(12, 2) DEFAULT 0,
    desconto_pontualidade NUMERIC(12, 2) DEFAULT 0,
    status_encerrado BOOLEAN DEFAULT FALSE,
    observacoes_contrato TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contrato Parcelas (Installments)
CREATE TABLE IF NOT EXISTS contrato_parcelas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    realm_id UUID NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
    contrato_id UUID REFERENCES contratos(id) ON DELETE CASCADE,
    unidade_id UUID REFERENCES unidades(id) ON DELETE SET NULL,
    inquilino_id UUID REFERENCES inquilinos(id) ON DELETE SET NULL,
    descricao VARCHAR(255),
    numero_parcela INTEGER,
    periodo_inicio DATE,
    periodo_fim DATE,
    valor_base NUMERIC(12, 2) DEFAULT 0,
    valor_iptu NUMERIC(12, 2) DEFAULT 0,
    valor_agua NUMERIC(12, 2) DEFAULT 0,
    valor_luz NUMERIC(12, 2) DEFAULT 0,
    valor_outros NUMERIC(12, 2) DEFAULT 0,
    desconto_pontualidade NUMERIC(12, 2) DEFAULT 0,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    valor_pago NUMERIC(12, 2),
    status_pagamento VARCHAR(20) DEFAULT 'pendente' CHECK (status_pagamento IN ('pendente', 'pago', 'atrasado', 'cancelado')),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contrato Renovações
CREATE TABLE IF NOT EXISTS contrato_renovacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    realm_id UUID NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
    contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
    valor_anterior NUMERIC(12, 2) NOT NULL,
    valor_novo NUMERIC(12, 2) NOT NULL,
    data_inicio_novo DATE NOT NULL,
    data_fim_novo DATE NOT NULL,
    indice_reajuste VARCHAR(100),
    observacoes TEXT,
    data_renovacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_propriedades_realm ON propriedades(realm_id);
CREATE INDEX IF NOT EXISTS idx_unidades_realm ON unidades(realm_id);
CREATE INDEX IF NOT EXISTS idx_inquilinos_realm ON inquilinos(realm_id);
CREATE INDEX IF NOT EXISTS idx_contratos_realm ON contratos(realm_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_realm ON contrato_parcelas(realm_id);
CREATE INDEX IF NOT EXISTS idx_renovacoes_realm ON contrato_renovacoes(realm_id);

CREATE INDEX IF NOT EXISTS idx_contratos_inquilino ON contratos(inquilino_id);
CREATE INDEX IF NOT EXISTS idx_contratos_unidade ON contratos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_contrato ON contrato_parcelas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_unidade ON contrato_parcelas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_inquilino ON contrato_parcelas(inquilino_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_status ON contrato_parcelas(status_pagamento);
CREATE INDEX IF NOT EXISTS idx_renovacoes_contrato ON contrato_renovacoes(contrato_id);
CREATE INDEX IF NOT EXISTS idx_inquilinos_cpf ON inquilinos(cpf);
CREATE INDEX IF NOT EXISTS idx_unidades_propriedade ON unidades(propriedade_id);
CREATE INDEX IF NOT EXISTS idx_unidades_status ON unidades(status);

-- Subscription-related tables (added for Mercado Pago integration)
-- Planos (subscription plans)
CREATE TABLE IF NOT EXISTS planos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    preco DECIMAL(10, 2) NOT NULL,
    intervalo_cobranca VARCHAR(20) NOT NULL CHECK (intervalo_cobranca IN ('monthly', 'yearly')), -- monthly or yearly
    limite_propriedades INTEGER DEFAULT NULL, -- NULL means unlimited
    limite_inquilinos INTEGER DEFAULT NULL, -- NULL means unlimited
    limite_contratos INTEGER DEFAULT NULL, -- NULL means unlimited
    features JSONB DEFAULT '[]', -- Additional features as JSON array
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assinaturas (user subscriptions)
CREATE TABLE IF NOT EXISTS assinaturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    plano_id UUID NOT NULL REFERENCES planos(id) ON DELETE RESTRICT,
    realm_id UUID NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'cancelled', 'expired', 'past_due')),
    mercadopago_subscription_id VARCHAR(255), -- Mercado Pago subscription ID
    mercadopago_plan_id VARCHAR(255), -- Original plan ID in Mercado Pago
    data_inicio DATE NOT NULL,
    data_fim DATE,
    data_proxima_cobranca DATE,
    valor_assinatura DECIMAL(10, 2) NOT NULL,
    metodo_pagamento VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pagamentos (individual payments)
CREATE TABLE IF NOT EXISTS pagamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assinatura_id UUID NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
    realm_id UUID NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
    mercadopago_payment_id VARCHAR(255), -- Mercado Pago payment ID
    mercadopago_invoice_id VARCHAR(255), -- Mercado Pago invoice ID
    valor DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'refunded', 'charged_back', 'cancelled')),
    data_pagamento DATE,
    data_vencimento DATE NOT NULL,
    metodo_pagamento VARCHAR(50),
    dados_pagamento JSONB DEFAULT '{}', -- Additional payment data from Mercado Pago
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add subscription columns to existing tables
ALTER TABLE realms ADD COLUMN IF NOT EXISTS assinatura_atual_id UUID REFERENCES assinaturas(id) ON DELETE SET NULL;
ALTER TABLE realms ADD COLUMN IF NOT EXISTS status_assinatura VARCHAR(50) DEFAULT 'trial' CHECK (status_assinatura IN ('trial', 'active', 'suspended', 'cancelled', 'expired', 'past_due'));

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS data_inicio_assinatura DATE;

-- Additional indexes for subscription tables
CREATE INDEX IF NOT EXISTS idx_assinaturas_usuario ON assinaturas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_plano ON assinaturas(plano_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_realm ON assinaturas(realm_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_status ON assinaturas(status);
CREATE INDEX IF NOT EXISTS idx_assinaturas_mp_subscription ON assinaturas(mercadopago_subscription_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_assinatura ON pagamentos(assinatura_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_realm ON pagamentos(realm_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON pagamentos(status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_data_vencimento ON pagamentos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_realms_assinatura_atual ON realms(assinatura_atual_id);
CREATE INDEX IF NOT EXISTS idx_realms_status_assinatura ON realms(status_assinatura);

-- Insert default plans
INSERT INTO planos (nome, descricao, preco, intervalo_cobranca, limite_propriedades, limite_inquilinos, limite_contratos, features, ativo)
VALUES
    ('Plano Básico', 'Plano gratuito com funcionalidades básicas', 0.00, 'monthly', 1, 5, 5, '["1 propriedade", "5 inquilinos", "5 contratos"]', true),
    ('Plano Profissional', 'Plano completo para pequenos proprietários', 49.90, 'monthly', 5, 25, 25, '["5 propriedades", "25 inquilinos", "25 contratos", "Relatórios avançados"]', true),
    ('Plano Empresarial', 'Plano para grandes proprietários e imobiliárias', 99.90, 'monthly', 20, 100, 100, '["20 propriedades", "100 inquilinos", "100 contratos", "Relatórios avançados", "Suporte prioritário"]', true);

