-- =============================================
-- Migration 006: Multi-Tenant SaaS (Organizações)
-- Created: 2026-02-26
-- =============================================

-- 1. Tabela de organizações
CREATE TABLE IF NOT EXISTS organizacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizacoes_slug ON organizacoes(slug);

-- 2. Criar organizacao padrão e migrar dados existentes
DO $$
DECLARE
    org_id UUID;
BEGIN
    -- Criar org padrão
    INSERT INTO organizacoes (nome, slug) VALUES ('Padrão', 'padrao')
    ON CONFLICT (slug) DO NOTHING;

    SELECT id INTO org_id FROM organizacoes WHERE slug = 'padrao';

    -- 3. Adicionar organizacao_id em todas as tabelas de negócio

    -- usuarios
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id) ON DELETE CASCADE;
    UPDATE usuarios SET organizacao_id = org_id WHERE organizacao_id IS NULL;

    -- propriedades
    ALTER TABLE propriedades ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id) ON DELETE CASCADE;
    UPDATE propriedades SET organizacao_id = org_id WHERE organizacao_id IS NULL;

    -- inquilinos
    ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id) ON DELETE CASCADE;
    UPDATE inquilinos SET organizacao_id = org_id WHERE organizacao_id IS NULL;

    -- contratos
    ALTER TABLE contratos ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id) ON DELETE CASCADE;
    UPDATE contratos SET organizacao_id = org_id WHERE organizacao_id IS NULL;

    -- contrato_parcelas
    ALTER TABLE contrato_parcelas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id) ON DELETE CASCADE;
    UPDATE contrato_parcelas SET organizacao_id = org_id WHERE organizacao_id IS NULL;

    -- perfis
    ALTER TABLE perfis ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id) ON DELETE CASCADE;
    UPDATE perfis SET organizacao_id = org_id WHERE organizacao_id IS NULL;

    -- auditoria
    ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id) ON DELETE CASCADE;
    UPDATE auditoria SET organizacao_id = org_id WHERE organizacao_id IS NULL;

END $$;

-- 4. Indexes para performance em queries filtradas por org
CREATE INDEX IF NOT EXISTS idx_usuarios_org ON usuarios(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_propriedades_org ON propriedades(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_inquilinos_org ON inquilinos(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_contratos_org ON contratos(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_org ON contrato_parcelas(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_perfis_org ON perfis(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_org ON auditoria(organizacao_id);

-- 5. CPF único por organização (não mais global)
-- Remover constraint global e criar unique composta
ALTER TABLE inquilinos DROP CONSTRAINT IF EXISTS inquilinos_cpf_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inquilinos_cpf_org ON inquilinos(cpf, organizacao_id);

-- 6. Nome de perfil único por organização (não mais global)
ALTER TABLE perfis DROP CONSTRAINT IF EXISTS perfis_nome_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_perfis_nome_org ON perfis(nome, organizacao_id);
