'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/RequireRole';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Search, Pencil, Trash2, X, ShieldCheck, Users } from 'lucide-react';

interface Usuario {
    id: string;
    nome: string;
    email: string;
    is_admin: boolean;
    perfil_id: string | null;
    perfil_nome: string | null;
    created_at: string;
    updated_at: string;
}

interface PerfilOption {
    id: string;
    nome: string;
}

interface PaginatedResponse {
    data: Usuario[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

const emptyForm = {
    nome: '',
    email: '',
    senha: '',
    is_admin: false,
    perfil_id: '' as string,
};

export default function UsuariosPage() {
    const { isAdmin } = useAuth();
    const [paginationData, setPaginationData] = useState<PaginatedResponse | null>(null);
    const [perfis, setPerfis] = useState<PerfilOption[]>([]);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Usuario | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Load profiles for dropdown
    useEffect(() => {
        api.get('/perfis?limit=100').then(res => {
            setPerfis(res.data?.map((p: { id: string; nome: string }) => ({ id: p.id, nome: p.nome })) || []);
        }).catch(console.error);
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', currentPage.toString());
            params.set('limit', itemsPerPage.toString());
            if (search) params.set('search', search);

            const response = await api.get(`/auth/users?${params.toString()}`);
            setPaginationData(response);
        } catch (err) {
            console.error(err);
            setError('Erro ao carregar usuários');
        } finally {
            setLoading(false);
        }
    }, [search, currentPage, itemsPerPage]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const usuarios = paginationData?.data || [];
    const pagination = paginationData?.pagination;

    const openNew = () => {
        setForm(emptyForm);
        setEditing(null);
        setShowForm(true);
        setError('');
    };

    const openEdit = (u: Usuario) => {
        setForm({
            nome: u.nome,
            email: u.email,
            senha: '',
            is_admin: u.is_admin || false,
            perfil_id: u.perfil_id || '',
        });
        setEditing(u);
        setShowForm(true);
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            if (editing) {
                await api.put(`/auth/users/${editing.id}`, {
                    is_admin: form.is_admin,
                    perfil_id: form.perfil_id || null,
                });
            } else {
                await api.post('/auth/register', {
                    nome: form.nome,
                    email: form.email,
                    senha: form.senha,
                    is_admin: form.is_admin,
                    perfil_id: form.perfil_id || null,
                });
            }

            setShowForm(false);
            loadData();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deseja realmente remover este usuário?')) return;
        try {
            await api.delete(`/auth/users/${id}`);
            loadData();
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Erro ao remover');
        }
    };

    const inputClass = "w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]";

    // Redirect if not admin
    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <ShieldCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-[var(--color-text)]">Acesso Negado</h2>
                    <p className="text-[var(--color-text-muted)] mt-2">Apenas administradores podem gerenciar usuários.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pt-10 md:pt-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text)]">Usuários</h1>
                    <p className="text-[var(--color-text-muted)] mt-1">Gerencie os usuários e permissões</p>
                </div>
                <button onClick={openNew}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold
                        hover:bg-[var(--color-primary-hover)] transition-all shadow-lg shadow-blue-500/25">
                    <Plus className="w-5 h-5" /> Novo Usuário
                </button>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                <input type="text" placeholder="Buscar por nome ou email..." value={search}
                    onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--color-border)] bg-white
                        focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/80">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Nome</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Email</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Perfil</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Criado em</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-[var(--color-text-muted)]">Carregando...</td></tr>
                            ) : usuarios.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-[var(--color-text-muted)]">Nenhum usuário encontrado</p>
                                    </td>
                                </tr>
                            ) : (
                                usuarios.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-medium">
                                            <div className="flex items-center gap-2">
                                                {u.nome}
                                                {u.is_admin && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                                        <ShieldCheck className="w-3 h-3" /> Admin
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                                        <td className="px-6 py-4">
                                            {u.perfil_nome ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                                    <ShieldCheck className="w-3 h-3" /> {u.perfil_nome}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400">
                                                    {u.is_admin ? 'Acesso total' : 'Sem perfil'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(u.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => openEdit(u)} className="p-2 rounded-lg hover:bg-blue-50 text-[var(--color-primary)]">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(u.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {pagination && (
                <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={setCurrentPage}
                    onLimitChange={setItemsPerPage}
                />
            )}

            {/* Modal Form */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                            <h2 className="text-xl font-bold">{editing ? 'Editar Usuário' : 'Novo Usuário'}</h2>
                            <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-gray-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Nome *</label>
                                <input type="text" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
                                    required={!editing} disabled={!!editing} placeholder="Nome completo"
                                    className={`${inputClass} ${editing ? 'opacity-60 cursor-not-allowed' : ''}`} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Email *</label>
                                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                                    required={!editing} disabled={!!editing} placeholder="email@exemplo.com"
                                    className={`${inputClass} ${editing ? 'opacity-60 cursor-not-allowed' : ''}`} />
                            </div>
                            {!editing && (
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Senha *</label>
                                    <input type="password" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })}
                                        required placeholder="Mínimo 6 caracteres" minLength={6} className={inputClass} />
                                </div>
                            )}

                            {/* Admin Toggle */}
                            <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-border)] bg-gray-50/50">
                                <div>
                                    <p className="text-sm font-medium text-[var(--color-text)]">Administrador</p>
                                    <p className="text-xs text-[var(--color-text-muted)]">Acesso total ao sistema, ignora permissões do perfil</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, is_admin: !form.is_admin })}
                                    className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${form.is_admin ? 'bg-red-500' : 'bg-gray-300'}`}
                                >
                                    <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${form.is_admin ? 'translate-x-5' : ''}`} />
                                </button>
                            </div>

                            {/* Profile Selector */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Perfil de Acesso</label>
                                <select value={form.perfil_id} onChange={e => setForm({ ...form, perfil_id: e.target.value })}
                                    className={inputClass}>
                                    <option value="">
                                        {form.is_admin ? '(Admin - acesso total)' : 'Selecione um perfil'}
                                    </option>
                                    {perfis.map(p => (
                                        <option key={p.id} value={p.id}>{p.nome}</option>
                                    ))}
                                </select>
                                {!form.is_admin && !form.perfil_id && (
                                    <p className="text-xs text-amber-600 mt-1">⚠ Sem perfil, o usuário não terá acesso a nenhum módulo.</p>
                                )}
                            </div>

                            {error && (
                                <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                                    <p className="text-red-600 text-sm">{error}</p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowForm(false)}
                                    className="px-6 py-3 rounded-xl border border-[var(--color-border)] font-medium hover:bg-gray-50">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={saving}
                                    className="px-6 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold
                                    hover:bg-[var(--color-primary-hover)] disabled:opacity-50 shadow-lg shadow-blue-500/25">
                                    {saving ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
