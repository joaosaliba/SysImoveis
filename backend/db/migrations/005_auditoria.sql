-- =============================================
-- Migration 005: auditoria
-- =============================================

CREATE TABLE IF NOT EXISTS auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    acao VARCHAR(50) NOT NULL, -- e.g., 'CRIAR', 'ATUALIZAR', 'EXCLUIR', 'LOGIN'
    entidade VARCHAR(100) NOT NULL, -- e.g., 'IMOVEL', 'CONTRATO', 'INQUILINO', 'USUARIO'
    entidade_id UUID,
    dados_antigos JSONB,
    dados_novos JSONB,
    detalhes TEXT,
    ip VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_acao ON auditoria(acao);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidade ON auditoria(entidade);
CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON auditoria(created_at DESC);
