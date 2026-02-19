-- =============================================
-- GestaoImoveis - Database Schema
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Usuarios (Authentication)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    role VARCHAR(20) DEFAULT 'gestor' CHECK (role IN ('admin', 'gestor', 'inquilino')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for role lookups
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON usuarios(role);

-- Propriedades (Imóveis / Edifícios)
CREATE TABLE IF NOT EXISTS propriedades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    cpf VARCHAR(14) UNIQUE NOT NULL,
    nome_completo VARCHAR(255) NOT NULL,
    rg VARCHAR(20),
    orgao_emissor VARCHAR(20),
    uf_rg CHAR(2),
    telefones JSONB DEFAULT '[]',
    email VARCHAR(255),
    observacoes TEXT,
    restricoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contratos
CREATE TABLE IF NOT EXISTS contratos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inquilino_id UUID NOT NULL REFERENCES inquilinos(id) ON DELETE RESTRICT,
    unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE RESTRICT,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    qtd_ocupantes INTEGER DEFAULT 1,
    valor_inicial NUMERIC(12, 2) NOT NULL,
    dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    -- Default values for breakdown
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
    contrato_id UUID REFERENCES contratos(id) ON DELETE CASCADE, -- Nullable for standalone
    unidade_id UUID REFERENCES unidades(id) ON DELETE SET NULL,
    inquilino_id UUID REFERENCES inquilinos(id) ON DELETE SET NULL,
    descricao VARCHAR(255), -- Ex: "Aluguel Jan/2026" or "Multa"
    numero_parcela INTEGER,
    periodo_inicio DATE,
    periodo_fim DATE,
    valor_base NUMERIC(12, 2) DEFAULT 0, -- Aluguel
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

-- Contrato Renovações (History of changes)
CREATE TABLE IF NOT EXISTS contrato_renovacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON usuarios(role);
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
