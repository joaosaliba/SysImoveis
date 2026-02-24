'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/RequireRole';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Search, Pencil, Trash2, X, ShieldCheck, Users, Eye, Save, Trash, Check } from 'lucide-react';

interface Permissao {
    modulo: string;
    acao: string;
    permitido: boolean;
}

interface Modulo {
    key: string;
    label: string;
    acoes: string[];
}

interface Perfil {
    id: string;
    nome: string;
    descricao: string;
    total_usuarios: number;
    permissoes?: Permissao[];
    created_at: string;
}

interface PaginatedResponse {
    data: Perfil[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

const ACAO_LABELS: Record<string, { label: string; icon: typeof Eye }> = {
    ver: { label: 'Visualizar', icon: Eye },
    salvar: { label: 'Salvar', icon: Save },
    deletar: { label: 'Deletar', icon: Trash },
};

export default function PerfisPage() {
    const { isAdmin } = useAuth();
    const [paginationData, setPaginationData] = useState<PaginatedResponse | null>(null);
    const [modulos, setModulos] = useState<Modulo[]>([]);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Perfil | null>(null);
    const [form, setForm] = useState({ nome: '', descricao: '' });
    const [permGrid, setPermGrid] = useState<Record<string, Record<string, boolean>>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Load modules definition
    useEffect(() => {
        api.get('/perfis/modulos').then(setModulos).catch(console.error);
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', currentPage.toString());
            params.set('limit', itemsPerPage.toString());
            if (search) params.set('search', search);
            const response = await api.get(`/perfis?${params.toString()}`);
            setPaginationData(response);
        } catch (err) {
            console.error(err);
            setError('Erro ao carregar perfis');
        } finally {
            setLoading(false);
        }
    }, [search, currentPage, itemsPerPage]);

    useEffect(() => { loadData(); }, [loadData]);

    const perfis = paginationData?.data || [];
    const pagination = paginationData?.pagination;

    // Build empty permission grid from modules
    const buildEmptyGrid = (): Record<string, Record<string, boolean>> => {
        const grid: Record<string, Record<string, boolean>> = {};
        for (const m of modulos) {
            grid[m.key] = {};
            for (const a of m.acoes) {
                grid[m.key][a] = false;
            }
        }
        return grid;
    };

    // Build grid from permission array
    const buildGridFromPermissoes = (permissoes: Permissao[]): Record<string, Record<string, boolean>> => {
        const grid = buildEmptyGrid();
        for (const p of permissoes) {
            if (grid[p.modulo]) {
                grid[p.modulo][p.acao] = p.permitido;
            }
        }
        return grid;
    };

    const openNew = () => {
        setForm({ nome: '', descricao: '' });
        setPermGrid(buildEmptyGrid());
        setEditing(null);
        setShowForm(true);
        setError('');
    };

    const openEdit = async (perfil: Perfil) => {
        try {
            const detail = await api.get(`/perfis/${perfil.id}`);
            setForm({ nome: detail.nome, descricao: detail.descricao || '' });
            setPermGrid(buildGridFromPermissoes(detail.permissoes || []));
            setEditing(detail);
            setShowForm(true);
            setError('');
        } catch (err) {
            console.error(err);
        }
    };

    const togglePerm = (modulo: string, acao: string) => {
        setPermGrid(prev => ({
            ...prev,
            [modulo]: {
                ...prev[modulo],
                [acao]: !prev[modulo]?.[acao]
            }
        }));
    };

    // Toggle all permissions for a module
    const toggleModulo = (modulo: string) => {
        const mod = permGrid[modulo];
        const allEnabled = Object.values(mod).every(v => v);
        setPermGrid(prev => {
            const updated = { ...prev[modulo] };
            for (const key of Object.keys(updated)) {
                updated[key] = !allEnabled;
            }
            return { ...prev, [modulo]: updated };
        });
    };

    // Toggle all
    const toggleAll = () => {
        const allEnabled = Object.values(permGrid).every(mod => Object.values(mod).every(v => v));
        setPermGrid(prev => {
            const newGrid: Record<string, Record<string, boolean>> = {};
            for (const m of Object.keys(prev)) {
                newGrid[m] = {};
                for (const a of Object.keys(prev[m])) {
                    newGrid[m][a] = !allEnabled;
                }
            }
            return newGrid;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        // Convert grid to array
        const permissoes: Permissao[] = [];
        for (const [modulo, acoes] of Object.entries(permGrid)) {
            for (const [acao, permitido] of Object.entries(acoes)) {
                permissoes.push({ modulo, acao, permitido });
            }
        }

        try {
            const payload = { nome: form.nome, descricao: form.descricao, permissoes };
            if (editing) {
                await api.put(`/perfis/${editing.id}`, payload);
            } else {
                await api.post('/perfis', payload);
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
        if (!confirm('Deseja realmente remover este perfil? Usuários vinculados perderão o perfil.')) return;
        try {
            await api.delete(`/perfis/${id}`);
            loadData();
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Erro ao remover');
        }
    };

    const inputClass = "w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]";

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <ShieldCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-[var(--color-text)]">Acesso Negado</h2>
                    <p className="text-[var(--color-text-muted)] mt-2">Apenas administradores podem gerenciar perfis.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pt-10 md:pt-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text)]">Perfis de Acesso</h1>
                    <p className="text-[var(--color-text-muted)] mt-1">Gerencie os perfis e permissões do sistema</p>
                </div>
                <button onClick={openNew}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold
                        hover:bg-[var(--color-primary-hover)] transition-all shadow-lg shadow-blue-500/25">
                    <Plus className="w-5 h-5" /> Novo Perfil
                </button>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                <input type="text" placeholder="Buscar perfis..." value={search}
                    onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--color-border)] bg-white
                        focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
            </div>

            {/* Perfis Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/80">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Nome</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Descrição</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Usuários</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                            {loading ? (
                                <tr><td colSpan={4} className="px-6 py-12 text-center text-[var(--color-text-muted)]">Carregando...</td></tr>
                            ) : perfis.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-[var(--color-text-muted)]">Nenhum perfil encontrado</p>
                                    </td>
                                </tr>
                            ) : (
                                perfis.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="font-semibold text-[var(--color-text)]">{p.nome}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{p.descricao || '—'}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                                <Users className="w-3 h-3" /> {p.total_usuarios}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-blue-50 text-[var(--color-primary)]">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500">
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
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                            <h2 className="text-xl font-bold">{editing ? 'Editar Perfil' : 'Novo Perfil'}</h2>
                            <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-gray-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Name and description */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Nome do Perfil *</label>
                                    <input type="text" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
                                        required placeholder="Ex: Auxiliar, Gestor de Imóveis" className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Descrição</label>
                                    <input type="text" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                                        placeholder="Descrição do perfil" className={inputClass} />
                                </div>
                            </div>

                            {/* Permission Grid */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-[var(--color-text)] uppercase tracking-wider">Permissões</h3>
                                    <button type="button" onClick={toggleAll}
                                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[var(--color-text)] font-medium transition-colors">
                                        {Object.values(permGrid).every(mod => Object.values(mod).every(v => v)) ? 'Desmarcar Todos' : 'Marcar Todos'}
                                    </button>
                                </div>

                                <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50/80">
                                            <tr>
                                                <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase w-1/3">Módulo</th>
                                                {['ver', 'salvar', 'deletar'].map(acao => {
                                                    const info = ACAO_LABELS[acao];
                                                    const Icon = info.icon;
                                                    return (
                                                        <th key={acao} className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <Icon className="w-3.5 h-3.5" />
                                                                {info.label}
                                                            </div>
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--color-border)]">
                                            {modulos.map(m => (
                                                <tr key={m.key} className="hover:bg-gray-50/50">
                                                    <td className="px-4 py-3">
                                                        <button type="button" onClick={() => toggleModulo(m.key)}
                                                            className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors text-left">
                                                            {m.label}
                                                        </button>
                                                    </td>
                                                    {['ver', 'salvar', 'deletar'].map(acao => {
                                                        const hasAcao = m.acoes.includes(acao);
                                                        const enabled = permGrid[m.key]?.[acao] ?? false;
                                                        return (
                                                            <td key={acao} className="px-4 py-3 text-center">
                                                                {hasAcao ? (
                                                                    <button type="button" onClick={() => togglePerm(m.key, acao)}
                                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all duration-200
                                                                            ${enabled
                                                                                ? 'bg-[var(--color-primary)] text-white shadow-sm shadow-blue-500/25'
                                                                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                                            }`}>
                                                                        <Check className="w-4 h-4" />
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-gray-300">—</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
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
