-- Migration: 002_saas_multitenancy
-- Description: Add support for multi-tenancy (Realms) and master user roles.

-- 1. Create Realms table
CREATE TABLE IF NOT EXISTS realms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- For personalized URLs or easy identification
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create a default Realm for existing data
INSERT INTO realms (id, nome, slug) 
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Realm', 'default')
ON CONFLICT DO NOTHING;

-- 3. Update Usuarios table
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS realm_id UUID REFERENCES realms(id) ON DELETE CASCADE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT FALSE;

-- Assign existing users to default realm
UPDATE usuarios SET realm_id = '00000000-0000-0000-0000-000000000000' WHERE realm_id IS NULL;
UPDATE usuarios SET is_master = TRUE; -- Mark everyone currently in the system as "master" of their realm (or the default realm for now)

-- 4. Update other tables with realm_id
DO $$ 
BEGIN
    -- Propriedades
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='propriedades' AND column_name='realm_id') THEN
        ALTER TABLE propriedades ADD COLUMN realm_id UUID REFERENCES realms(id) ON DELETE CASCADE;
        UPDATE propriedades SET realm_id = '00000000-0000-0000-0000-000000000000' WHERE realm_id IS NULL;
    END IF;

    -- Unidades
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='unidades' AND column_name='realm_id') THEN
        ALTER TABLE unidades ADD COLUMN realm_id UUID REFERENCES realms(id) ON DELETE CASCADE;
        UPDATE unidades SET realm_id = '00000000-0000-0000-0000-000000000000' WHERE realm_id IS NULL;
    END IF;

    -- Inquilinos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inquilinos' AND column_name='realm_id') THEN
        ALTER TABLE inquilinos ADD COLUMN realm_id UUID REFERENCES realms(id) ON DELETE CASCADE;
        UPDATE inquilinos SET realm_id = '00000000-0000-0000-0000-000000000000' WHERE realm_id IS NULL;
    END IF;

    -- Contratos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contratos' AND column_name='realm_id') THEN
        ALTER TABLE contratos ADD COLUMN realm_id UUID REFERENCES realms(id) ON DELETE CASCADE;
        UPDATE contratos SET realm_id = '00000000-0000-0000-0000-000000000000' WHERE realm_id IS NULL;
    END IF;

    -- Contrato Parcelas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contrato_parcelas' AND column_name='realm_id') THEN
        ALTER TABLE contrato_parcelas ADD COLUMN realm_id UUID REFERENCES realms(id) ON DELETE CASCADE;
        UPDATE contrato_parcelas SET realm_id = '00000000-0000-0000-0000-000000000000' WHERE realm_id IS NULL;
    END IF;

    -- Contrato Renovacoes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contrato_renovacoes' AND column_name='realm_id') THEN
        ALTER TABLE contrato_renovacoes ADD COLUMN realm_id UUID REFERENCES realms(id) ON DELETE CASCADE;
        UPDATE contrato_renovacoes SET realm_id = '00000000-0000-0000-0000-000000000000' WHERE realm_id IS NULL;
    END IF;
END $$;

-- 5. Add indexes for realm_id in all tables for performance
CREATE INDEX IF NOT EXISTS idx_usuarios_realm ON usuarios(realm_id);
CREATE INDEX IF NOT EXISTS idx_propriedades_realm ON propriedades(realm_id);
CREATE INDEX IF NOT EXISTS idx_unidades_realm ON unidades(realm_id);
CREATE INDEX IF NOT EXISTS idx_inquilinos_realm ON inquilinos(realm_id);
CREATE INDEX IF NOT EXISTS idx_contratos_realm ON contratos(realm_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_realm ON contrato_parcelas(realm_id);
CREATE INDEX IF NOT EXISTS idx_renovacoes_realm ON contrato_renovacoes(realm_id);
