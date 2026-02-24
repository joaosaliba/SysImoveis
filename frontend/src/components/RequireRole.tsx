'use client';

import { useState, useEffect, ReactNode } from 'react';
import { isAdmin } from '@/lib/api';

interface RequireAdminProps {
    children: ReactNode;
    fallback?: ReactNode;
}

/**
 * Componente para proteger conteúdo exclusivo de administradores.
 *
 * Exemplo:
 * <RequireAdmin>
 *   <AdminPanel />
 * </RequireAdmin>
 */
export default function RequireAdmin({ children, fallback }: RequireAdminProps) {
    const [authorized, setAuthorized] = useState<boolean | null>(null);

    useEffect(() => {
        setAuthorized(isAdmin());
    }, []);

    if (authorized === null) return null;
    if (!authorized) return fallback ? <>{fallback}</> : null;
    return <>{children}</>;
}

/**
 * Hook para verificar se o usuário atual é admin.
 *
 * Exemplo:
 * const { admin } = useAuth();
 * if (admin) { ... }
 */
export function useAuth() {
    const [admin, setAdmin] = useState(false);

    useEffect(() => {
        setAdmin(isAdmin());
    }, []);

    return { isAdmin: admin };
}
