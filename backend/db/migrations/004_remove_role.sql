-- =============================================
-- Migration 004: Remover role, unificar com perfil
-- =============================================

-- 1. Adicionar is_admin
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. Marcar admins existentes
UPDATE usuarios SET is_admin = TRUE WHERE role = 'admin';

-- 3. Remover constraint, index e coluna role
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;
DROP INDEX IF EXISTS idx_usuarios_role;
ALTER TABLE usuarios DROP COLUMN IF EXISTS role;
