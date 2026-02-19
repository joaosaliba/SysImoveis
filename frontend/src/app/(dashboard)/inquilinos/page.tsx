'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { maskCPF, maskPhone, maskRG } from '@/lib/masks';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Search, Pencil, Trash2, X, Users, AlertTriangle } from 'lucide-react';

interface Inquilino {
    id: string;
    cpf: string;
    nome_completo: string;
    rg: string;
    orgao_emissor: string;
    uf_rg: string;
    telefones: string[];
    email: string;
    observacoes: string;
    restricoes: string;
}

interface PaginatedResponse {
    data: Inquilino[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const emptyForm = {
    cpf: '', nome_completo: '', rg: '', orgao_emissor: '', uf_rg: '',
    telefone1: '', telefone2: '', email: '', observacoes: '', restricoes: '',
};

export default function InquilinosPage() {
    const [paginationData, setPaginationData] = useState<PaginatedResponse | null>(null);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Inquilino | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', currentPage.toString());
            params.set('limit', itemsPerPage.toString());
            if (search) params.set('search', search);

            const response = await api.get(`/inquilinos?${params.toString()}`);
            setPaginationData(response);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [search, currentPage, itemsPerPage]);

    useEffect(() => { loadData(); }, [loadData]);

    const inquilinos = paginationData?.data || [];
    const pagination = paginationData?.pagination;

    const openNew = () => { setForm(emptyForm); setEditing(null); setShowForm(true); setError(''); };

    const openEdit = (t: Inquilino) => {
        const tels = Array.isArray(t.telefones) ? t.telefones : [];
        setForm({
            cpf: t.cpf, nome_completo: t.nome_completo, rg: t.rg || '', orgao_emissor: t.orgao_emissor || '',
            uf_rg: t.uf_rg || '', telefone1: tels[0] || '', telefone2: tels[1] || '',
            email: t.email || '', observacoes: t.observacoes || '', restricoes: t.restricoes || '',
        });
        setEditing(t);
        setShowForm(true);
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload = {
                ...form,
                telefones: [form.telefone1, form.telefone2].filter(Boolean),
            };
            if (editing) {
                await api.put(`/inquilinos/${editing.id}`, payload);
            } else {
                await api.post('/inquilinos', payload);
            }
            setShowForm(false);
            loadData();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deseja realmente remover este inquilino?')) return;
        try { await api.delete(`/inquilinos/${id}`); loadData(); }
        catch (err: unknown) { alert(err instanceof Error ? err.message : 'Erro ao remover'); }
    };

    return (
        <div className="space-y-6 pt-10 md:pt-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text)]">Inquilinos</h1>
                    <p className="text-[var(--color-text-muted)] mt-1">Gerencie seus inquilinos</p>
                </div>
                <button onClick={openNew}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold
            hover:bg-[var(--color-primary-hover)] transition-all duration-200 shadow-lg shadow-blue-500/25">
                    <Plus className="w-5 h-5" /> Novo Inquilino
                </button>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                <input type="text" placeholder="Buscar por nome ou CPF..." value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--color-border)] bg-white
            focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all" />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/80">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Nome</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider hidden sm:table-cell">CPF</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider hidden lg:table-cell">Telefone</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Restrições</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-[var(--color-text-muted)]">Carregando...</td></tr>
                            ) : inquilinos.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-[var(--color-text-muted)]">Nenhum inquilino encontrado</p>
                                    </td>
                                </tr>
                            ) : inquilinos.map(t => (
                                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium">{t.nome_completo}</td>
                                    <td className="px-6 py-4 text-sm hidden sm:table-cell font-mono">{t.cpf}</td>
                                    <td className="px-6 py-4 text-sm hidden lg:table-cell">
                                        {Array.isArray(t.telefones) && t.telefones.length > 0 ? t.telefones[0] : '—'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {t.restricoes ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                                <AlertTriangle className="w-3 h-3" /> Restrição
                                            </span>
                                        ) : (
                                            <span className="text-sm text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => openEdit(t)} className="p-2 rounded-lg hover:bg-blue-50 text-[var(--color-primary)]">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(t.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
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
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                            <h2 className="text-xl font-bold">{editing ? 'Editar Inquilino' : 'Novo Inquilino'}</h2>
                            <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Nome Completo *</label>
                                    <input type="text" value={form.nome_completo} onChange={e => setForm({ ...form, nome_completo: e.target.value })}
                                        required placeholder="Nome completo"
                                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">CPF *</label>
                                    <input type="text" value={form.cpf} onChange={e => setForm({ ...form, cpf: maskCPF(e.target.value) })}
                                        required placeholder="000.000.000-00" maxLength={14}
                                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Email</label>
                                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                                        placeholder="email@exemplo.com"
                                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">RG</label>
                                    <input type="text" value={form.rg} onChange={e => setForm({ ...form, rg: maskRG(e.target.value) })}
                                        placeholder="00.000.000-0" maxLength={12}
                                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Órgão Emissor</label>
                                    <input type="text" value={form.orgao_emissor} onChange={e => setForm({ ...form, orgao_emissor: e.target.value })}
                                        placeholder="SSP"
                                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">UF do RG</label>
                                    <select value={form.uf_rg} onChange={e => setForm({ ...form, uf_rg: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]">
                                        <option value="">Selecione</option>
                                        {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Telefone 1</label>
                                    <input type="text" value={form.telefone1} onChange={e => setForm({ ...form, telefone1: maskPhone(e.target.value) })}
                                        placeholder="(00) 00000-0000" maxLength={15}
                                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Telefone 2</label>
                                    <input type="text" value={form.telefone2} onChange={e => setForm({ ...form, telefone2: maskPhone(e.target.value) })}
                                        placeholder="(00) 00000-0000" maxLength={15}
                                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Observações</label>
                                <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}
                                    rows={2} placeholder="Observações..."
                                    className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] resize-none" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-red-600 mb-1.5">⚠️ Restrições</label>
                                <textarea value={form.restricoes} onChange={e => setForm({ ...form, restricoes: e.target.value })}
                                    rows={2} placeholder="SPC, SERASA, processos judiciais..."
                                    className="w-full px-4 py-3 rounded-xl border border-red-200 bg-red-50/50
                    focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 resize-none text-red-800
                    placeholder:text-red-300" />
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
