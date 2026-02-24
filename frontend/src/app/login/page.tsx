'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, register } from '@/lib/api';
import { Building2, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const senhaValid = senha.length >= 6;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, senha);
            router.push('/dashboard');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-[var(--color-bg)] to-indigo-50 p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-primary)] shadow-lg shadow-blue-500/30 mb-4">
                        <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">
                        Sys<span className="text-[var(--color-primary)]">Imóveis</span>
                    </h1>
                    <p className="text-[var(--color-text-muted)] mt-1">
                        Entre na sua conta
                    </p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl shadow-black/5 p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                className={`w-full px-4 py-3 rounded-xl border bg-[var(--color-bg)] text-[var(--color-text)]
                  focus:outline-none focus:ring-2 transition-all duration-200
                  ${email && !emailValid ? 'border-red-300 focus:ring-red-500/30' : 'border-[var(--color-border)] focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]'}
                `}
                            />
                            {email && !emailValid && (
                                <p className="text-red-500 text-xs mt-1">Email inválido</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                                Senha
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={senha}
                                    onChange={(e) => setSenha(e.target.value)}
                                    placeholder="••••••••"
                                    className={`w-full px-4 py-3 pr-12 rounded-xl border bg-[var(--color-bg)] text-[var(--color-text)]
                    focus:outline-none focus:ring-2 transition-all duration-200
                    ${senha && !senhaValid ? 'border-red-300 focus:ring-red-500/30' : 'border-[var(--color-border)] focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]'}
                  `}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {senha && !senhaValid && (
                                <p className="text-red-500 text-xs mt-1">Senha deve ter ao menos 6 caracteres</p>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                                <p className="text-red-600 text-sm">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !emailValid || !senhaValid}
                            className="w-full py-3.5 rounded-xl bg-[var(--color-primary)] text-white font-semibold text-base
                hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40
                active:scale-[0.98]"
                        >
                            {loading ? 'Carregando...' : 'Entrar'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
