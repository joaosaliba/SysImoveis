-- =============================================
-- Migration 003: Documentos do Inquilino
-- =============================================

CREATE TABLE IF NOT EXISTS inquilino_documentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inquilino_id UUID NOT NULL REFERENCES inquilinos(id) ON DELETE CASCADE,
    nome_original VARCHAR(255) NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    tipo VARCHAR(100) DEFAULT 'outro',
    mimetype VARCHAR(100),
    tamanho_bytes BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquilino_documentos_inquilino ON inquilino_documentos(inquilino_id);
