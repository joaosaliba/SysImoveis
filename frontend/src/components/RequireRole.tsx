'use client';

import { useEffect, useState } from 'react';
import { getUserRole, hasRole } from '@/lib/api';

interface RequireRoleProps {
    roles: string | string[];
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * Componente para proteger conteúdo baseado no role do usuário
 * 
 * Uso:
 * <RequireRole roles="admin">
 *   <ConteudoApenasAdmin />
 * </RequireRole>
 * 
 * <RequireRole roles={['admin', 'gestor']} fallback={<p>Acesso negado</p>}>
 *   <Conteudo />
 * </RequireRole>
 */
export default function RequireRole({ roles, children, fallback }: RequireRoleProps) {
    const [authorized, setAuthorized] = useState(false);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        const userRole = getUserRole();
        const roleList = Array.isArray(roles) ? roles : [roles];
        
        setAuthorized(userRole ? roleList.includes(userRole) : false);
        setChecked(true);
    }, [roles]);

    // Enquanto verifica o role, não renderiza nada (ou poderia mostrar loading)
    if (!checked) {
        return null;
    }

    if (!authorized) {
        return fallback ? <>{fallback}</> : null;
    }

    return <>{children}</>;
}

/**
 * Hook para verificar permissões de role
 * 
 * Uso:
 * const { hasRole, isAdmin, isGestor, role } = useRole();
 * 
 * if (hasRole('admin')) { ... }
 */
export function useRole() {
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        setRole(getUserRole());
    }, []);

    const hasRoleCheck = (allowedRoles: string | string[]): boolean => {
        if (!role) return false;
        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        return roles.includes(role);
    };

    return {
        role,
        hasRole: hasRoleCheck,
        isAdmin: hasRoleCheck('admin'),
        isGestor: hasRoleCheck(['admin', 'gestor']),
        isInquilino: hasRoleCheck('inquilino'),
    };
}
