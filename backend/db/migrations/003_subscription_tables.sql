-- Migration: 003_subscription_tables
-- Description: Add subscription-related tables for Mercado Pago integration

-- 1. Create planos table (subscription plans)
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

-- 2. Create assinaturas table (user subscriptions)
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

-- 3. Create pagamentos table (individual payments)
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

-- 4. Add columns to existing realms table to track subscription status
ALTER TABLE realms ADD COLUMN IF NOT EXISTS assinatura_atual_id UUID REFERENCES assinaturas(id) ON DELETE SET NULL;
ALTER TABLE realms ADD COLUMN IF NOT EXISTS status_assinatura VARCHAR(50) DEFAULT 'trial' CHECK (status_assinatura IN ('trial', 'active', 'suspended', 'cancelled', 'expired', 'past_due'));

-- 5. Add columns to existing usuarios table for subscription tracking
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS data_inicio_assinatura DATE;

-- 6. Add indexes for performance
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

-- 7. Insert default plans
INSERT INTO planos (nome, descricao, preco, intervalo_cobranca, limite_propriedades, limite_inquilinos, limite_contratos, features, ativo)
VALUES
    ('Plano Básico', 'Plano gratuito com funcionalidades básicas', 0.00, 'monthly', 1, 5, 5, '["1 propriedade", "5 inquilinos", "5 contratos"]', true),
    ('Plano Profissional', 'Plano completo para pequenos proprietários', 49.90, 'monthly', 5, 25, 25, '["5 propriedades", "25 inquilinos", "25 contratos", "Relatórios avançados"]', true),
    ('Plano Empresarial', 'Plano para grandes proprietários e imobiliárias', 99.90, 'monthly', 20, 100, 100, '["20 propriedades", "100 inquilinos", "100 contratos", "Relatórios avançados", "Suporte prioritário"]', true);