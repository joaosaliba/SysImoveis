-- Migration: Add role column to usuarios table
-- Run this to add user roles (admin, gestor, inquilino)

-- Add role column with default 'gestor'
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'gestor' 
CHECK (role IN ('admin', 'gestor', 'inquilino'));

-- Set existing users to 'gestor'
UPDATE usuarios SET role = 'gestor' WHERE role IS NULL;

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON usuarios(role);

-- Comment: admin = administrador total, gestor = gerente de propriedades, inquilino = apenas visualização
