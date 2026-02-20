'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard,
    Building2,
    Users,
    FileText,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Menu,
    X,
    Banknote,
    ShieldCheck,
    CreditCard,
} from 'lucide-react';
import { logout, getUser, isAdmin, isGestor, isSystemAdmin } from '@/lib/api';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/imoveis', label: 'Imóveis', icon: Building2 },
    { href: '/inquilinos', label: 'Inquilinos', icon: Users },
    { href: '/contratos', label: 'Contratos', icon: FileText },
    { href: '/boletos', label: 'Boletos', icon: Banknote },
];

const adminItems = [
    { href: '/usuarios', label: 'Usuários', icon: ShieldCheck },
];

const systemAdminItems = [
    { href: '/admin/system', label: 'Painel do Sistema', icon: LayoutDashboard },
];

const subscriptionItem = [
    { href: '/assinatura', label: 'Assinatura', icon: CreditCard },
];

const Sidebar = () => {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const router = useRouter();
    const [user, setUser] = useState<{ nome: string } | null>(null);
    const [admin, setAdmin] = useState(false);
    const [systemAdmin, setSystemAdmin] = useState(false);

    useEffect(() => {
        setUser(getUser());
        setAdmin(isAdmin());
        setSystemAdmin(isSystemAdmin());
    }, []);

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    return (
        <>
            {/* Mobile Hamburger */}
            <button
                onClick={() => setMobileOpen(true)}
                className="fixed top-4 left-4 z-50 p-2 rounded-xl bg-white shadow-lg md:hidden"
            >
                <Menu className="w-6 h-6 text-[var(--color-text)]" />
            </button>

            {/* Mobile Overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed top-0 left-0 h-screen z-50
          bg-[var(--color-sidebar)] text-white
          flex flex-col
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-20' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:sticky md:top-0 md:h-screen
        `}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    {!collapsed && (
                        <h1 className="text-lg font-bold tracking-tight">
                            Sys<span className="text-blue-400">Imóveis</span>
                        </h1>
                    )}
                    {/* Mobile Close */}
                    <button
                        onClick={() => setMobileOpen(false)}
                        className="p-1 rounded-lg hover:bg-white/10 md:hidden"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    {/* Desktop Toggle */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="p-1 rounded-lg hover:bg-white/10 hidden md:block"
                    >
                        {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-4 px-2 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                className={`
                  flex items-center gap-3 px-3 py-3 rounded-xl
                  text-white/80 hover:text-white hover:bg-[var(--color-sidebar-hover)]
                  transition-all duration-200
                  ${collapsed ? 'justify-center' : ''}
                `}
                            >
                                <Icon className="w-5 h-5 shrink-0" />
                                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                            </Link>
                        );
                    })}

                    {/* Subscription section - visible for admins and gestors */}
                    {(admin || isGestor()) && (
                        <>
                            {!collapsed && (
                                <div className="py-2 mt-2 border-t border-white/10">
                                    <p className="px-3 text-xs text-white/40 uppercase">Assinatura</p>
                                </div>
                            )}
                            {subscriptionItem.map((item: any) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileOpen(false)}
                                        className={`
                      flex items-center gap-3 px-3 py-3 rounded-xl
                      text-white/80 hover:text-white hover:bg-[var(--color-sidebar-hover)]
                      transition-all duration-200
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

                    {/* Global Admin section */}
                    {systemAdmin && (
                        <>
                            {!collapsed && (
                                <div className="py-2 mt-2 border-t border-white/10">
                                    <p className="px-3 text-xs text-white/40 uppercase">Acesso Total</p>
                                </div>
                            )}
                            {systemAdminItems.map((item: any) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileOpen(false)}
                                        className={`
                      flex items-center gap-3 px-3 py-3 rounded-xl
                      text-white/80 hover:text-white hover:bg-[var(--color-sidebar-hover)]
                      transition-all duration-200
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

                    {/* Admin-only section */}
                    {admin && (
                        <>
                            {!collapsed && (
                                <div className="py-2 mt-2 border-t border-white/10">
                                    <p className="px-3 text-xs text-white/40 uppercase">Administração</p>
                                </div>
                            )}
                            {adminItems.map((item: any) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileOpen(false)}
                                        className={`
                      flex items-center gap-3 px-3 py-3 rounded-xl
                      text-white/80 hover:text-white hover:bg-[var(--color-sidebar-hover)]
                      transition-all duration-200
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
                        <p className="text-xs text-white/60 mb-2 truncate">{user.nome}</p>
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
        </>
    );
};

export default Sidebar;
