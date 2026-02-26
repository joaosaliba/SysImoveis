'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard,
    Building2,
    Users,
    FileText,
    ChevronLeft,
    ChevronRight,
    LogOut,
    X,
    Banknote,
    ShieldCheck,
    History,
    MoreHorizontal,
} from 'lucide-react';
import { logout, getUser, isAdmin } from '@/lib/api';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/imoveis', label: 'Imóveis', icon: Building2 },
    { href: '/inquilinos', label: 'Inquilinos', icon: Users },
    { href: '/contratos', label: 'Contratos', icon: FileText },
    { href: '/boletos', label: 'Boletos', icon: Banknote },
];

const adminItems = [
    { href: '/usuarios', label: 'Usuários', icon: ShieldCheck },
    { href: '/perfis', label: 'Perfis', icon: ShieldCheck },
    { href: '/auditoria', label: 'Auditoria', icon: History },
];

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const [adminMenuOpen, setAdminMenuOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<{ nome: string; organizacao_nome?: string } | null>(null);
    const [admin, setAdmin] = useState(false);

    useEffect(() => {
        setUser(getUser());
        setAdmin(isAdmin());
    }, []);

    // Close admin menu when navigating
    useEffect(() => {
        setAdminMenuOpen(false);
    }, [pathname]);

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    // Bottom nav items for mobile — all 5 always visible
    const mobileNavItems = navItems;

    return (
        <>
            {/* ========== DESKTOP SIDEBAR (unchanged) ========== */}
            <aside
                className={`
          hidden md:flex
          fixed top-0 left-0 h-screen z-50
          bg-[var(--color-sidebar)] text-white
          flex-col
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-20' : 'w-64'}
          md:translate-x-0 md:sticky md:top-0 md:h-screen
        `}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    {!collapsed && (
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">
                                Sys<span className="text-blue-400">Imóveis</span>
                            </h1>
                            {user?.organizacao_nome && (
                                <p className="text-xs text-white/50 truncate mt-0.5">{user.organizacao_nome}</p>
                            )}
                        </div>
                    )}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="p-1 rounded-lg hover:bg-white/10"
                    >
                        {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-4 px-2 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = pathname === item.href || pathname?.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                  flex items-center gap-3 px-3 py-3 rounded-xl
                  transition-all duration-200
                  ${active
                                        ? 'text-white bg-[var(--color-sidebar-hover)]'
                                        : 'text-white/80 hover:text-white hover:bg-[var(--color-sidebar-hover)]'
                                    }
                  ${collapsed ? 'justify-center' : ''}
                `}
                            >
                                <Icon className="w-5 h-5 shrink-0" />
                                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                            </Link>
                        );
                    })}

                    {/* Admin-only section */}
                    {admin && (
                        <>
                            {!collapsed && (
                                <div className="py-2 mt-2 border-t border-white/10">
                                    <p className="px-3 text-xs text-white/40 uppercase">Administração</p>
                                </div>
                            )}
                            {adminItems.map((item) => {
                                const Icon = item.icon;
                                const active = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`
                      flex items-center gap-3 px-3 py-3 rounded-xl
                      transition-all duration-200
                      ${active
                                                ? 'text-white bg-[var(--color-sidebar-hover)]'
                                                : 'text-white/80 hover:text-white hover:bg-[var(--color-sidebar-hover)]'
                                            }
                      ${collapsed ? 'justify-center' : ''}
                    `}
                                    >
                                        <Icon className="w-5 h-5 shrink-0" />
                                        {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                                    </Link>
                                );
                            })}
                        </>
                    )}
                </nav>

                {/* User Footer */}
                <div className="p-4 border-t border-white/10">
                    {!collapsed && user && (
                        <p className="text-sm text-white/60 mb-2 truncate font-medium">{user.nome}</p>
                    )}
                    <button
                        onClick={handleLogout}
                        className={`
              flex items-center gap-3 w-full px-3 py-2 rounded-xl
              text-white/60 hover:text-white hover:bg-red-500/20
              transition-all duration-200
              ${collapsed ? 'justify-center' : ''}
            `}
                    >
                        <LogOut className="w-5 h-5 shrink-0" />
                        {!collapsed && <span className="text-sm">Sair</span>}
                    </button>
                </div>
            </aside>

            {/* ========== MOBILE BOTTOM NAV ========== */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-sidebar)] border-t border-white/10 safe-area-bottom">
                <div className="flex items-stretch">
                    {mobileNavItems.map((item) => {
                        const Icon = item.icon;
                        const active = pathname === item.href || pathname?.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                  flex-1 flex flex-col items-center justify-center gap-1 py-3 px-1
                  transition-all duration-200 min-h-[64px]
                  ${active
                                        ? 'text-white bg-white/10'
                                        : 'text-white/60 hover:text-white hover:bg-white/5'
                                    }
                `}
                            >
                                <Icon className="w-7 h-7 shrink-0" />
                                <span className="text-xs font-semibold leading-tight text-center">{item.label}</span>
                            </Link>
                        );
                    })}

                    {/* "Mais" overflow — always visible for all users */}
                    <div className="flex-1 relative">
                        <button
                            onClick={() => setAdminMenuOpen(v => !v)}
                            className={`
                  w-full flex flex-col items-center justify-center gap-1 py-3 px-1
                  transition-all duration-200 min-h-[64px]
                  ${adminMenuOpen ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'}
                `}
                        >
                            <MoreHorizontal className="w-7 h-7 shrink-0" />
                            <span className="text-xs font-semibold">Mais</span>
                        </button>

                        {/* Popover menu */}
                        {adminMenuOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setAdminMenuOpen(false)}
                                />
                                <div className="absolute bottom-full right-0 mb-2 w-56 bg-[var(--color-sidebar)] rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-50">
                                    {/* Admin section — only for admins */}
                                    {admin && (
                                        <>
                                            <div className="px-4 py-3 border-b border-white/10">
                                                <p className="text-xs text-white/40 uppercase font-semibold">Administração</p>
                                            </div>
                                            {adminItems.map((item) => {
                                                const Icon = item.icon;
                                                const active = pathname === item.href;
                                                return (
                                                    <Link
                                                        key={item.href}
                                                        href={item.href}
                                                        className={`
                                flex items-center gap-3 px-4 py-4
                                transition-colors duration-200
                                ${active
                                                                ? 'text-white bg-white/10'
                                                                : 'text-white/80 hover:text-white hover:bg-white/5'
                                                            }
                              `}
                                                    >
                                                        <Icon className="w-5 h-5 shrink-0" />
                                                        <span className="text-base font-medium">{item.label}</span>
                                                    </Link>
                                                );
                                            })}
                                        </>
                                    )}
                                    {/* User info + logout — always */}
                                    <div className="border-t border-white/10">
                                        {user && (
                                            <p className="px-4 pt-3 text-sm text-white/40 truncate">{user.nome}</p>
                                        )}
                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center gap-3 w-full px-4 py-4 text-white/60 hover:text-white hover:bg-red-500/20 transition-colors"
                                        >
                                            <LogOut className="w-5 h-5 shrink-0" />
                                            <span className="text-base font-medium">Sair</span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </nav>
        </>
    );
}
