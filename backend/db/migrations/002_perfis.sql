-- =============================================
-- Migration 002: Perfis e Permissões Granulares
-- =============================================

-- Tabela de perfis
CREATE TABLE IF NOT EXISTS perfis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissões de cada perfil (modulo + ação)
CREATE TABLE IF NOT EXISTS perfil_permissoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    perfil_id UUID NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
    modulo VARCHAR(50) NOT NULL,
    acao VARCHAR(20) NOT NULL,
    permitido BOOLEAN DEFAULT FALSE,
    UNIQUE(perfil_id, modulo, acao)
);

-- Vincular usuario a perfil
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS perfil_id UUID REFERENCES perfis(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_perfil_permissoes_perfil ON perfil_permissoes(perfil_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_perfil ON usuarios(perfil_id);

-- Criar perfil "Padrão" com acesso total
DO $$
DECLARE
    padrao_id UUID;
    m TEXT;
    a TEXT;
BEGIN
    -- Inserir perfil padrão se não existe
    INSERT INTO perfis (nome, descricao)
    VALUES ('Padrão', 'Perfil padrão com acesso total ao sistema')
    ON CONFLICT (nome) DO NOTHING;

    SELECT id INTO padrao_id FROM perfis WHERE nome = 'Padrão';

    -- Inserir todas as permissões como true
    FOREACH m IN ARRAY ARRAY['dashboard', 'imoveis', 'inquilinos', 'contratos', 'boletos', 'relatorios', 'usuarios']
    LOOP
        FOREACH a IN ARRAY ARRAY['ver', 'salvar', 'deletar']
        LOOP
            INSERT INTO perfil_permissoes (perfil_id, modulo, acao, permitido)
            VALUES (padrao_id, m, a, TRUE)
            ON CONFLICT (perfil_id, modulo, acao) DO NOTHING;
        END LOOP;
    END LOOP;

    -- Atribuir perfil padrão a usuários existentes que não são admin e não têm perfil
    UPDATE usuarios SET perfil_id = padrao_id WHERE role != 'admin' AND perfil_id IS NULL;
END $$;
