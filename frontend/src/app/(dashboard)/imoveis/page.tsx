'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { maskCEP } from '@/lib/masks';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Search, Pencil, Trash2, X, Building2, ChevronDown, ChevronUp, DoorOpen, Loader2 } from 'lucide-react';

interface Unidade {
    id: string;
    propriedade_id: string;
    identificador: string;
    tipo_unidade: string;
    area_m2: number | null;
    valor_sugerido: number | null;
    observacoes: string;
    status: string;
}

interface Propriedade {
    id: string;
    nome: string;
    endereco: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    administrador: string;
    observacoes: string;
    total_unidades: number;
    unidades_alugadas: number;
    unidades?: Unidade[];
}

const TIPOS_UNIDADE = ['Apartamento', 'Loja', 'Sala Comercial', 'Casa', 'Kitnet', 'Galpão', 'Sobrado', 'Outro'];
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const emptyPropForm = {
    nome: '', endereco: '', numero: '', complemento: '', bairro: '',
    cidade: '', uf: '', cep: '', administrador: '', observacoes: '',
};

const emptyUnitForm = {
    identificador: '', tipo_unidade: 'Apartamento', area_m2: '', valor_sugerido: '', observacoes: '',
};

export default function ImoveisPage() {
    const [propriedades, setPropriedades] = useState<Propriedade[]>([]);
    const [search, setSearch] = useState('');
    const [showPropForm, setShowPropForm] = useState(false);
    const [editingProp, setEditingProp] = useState<Propriedade | null>(null);
    const [propForm, setPropForm] = useState(emptyPropForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [loadingCep, setLoadingCep] = useState(false);

    // Units state
    const [expandedProp, setExpandedProp] = useState<string | null>(null);
    const [propUnidades, setPropUnidades] = useState<Unidade[]>([]);
    const [showUnitForm, setShowUnitForm] = useState(false);
    const [editingUnit, setEditingUnit] = useState<Unidade | null>(null);
    const [unitForm, setUnitForm] = useState(emptyUnitForm);
    const [unitSaving, setUnitSaving] = useState(false);
    const [unitError, setUnitError] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;


    const loadData = useCallback(async () => {
        try {
            const data = await api.get(`/propriedades${search ? `?search=${search}` : ''}`);
            setPropriedades(data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [search]);

    useEffect(() => { loadData(); }, [loadData]);

    const totalPages = Math.ceil(propriedades.length / itemsPerPage);
    const paginatedPropriedades = propriedades.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // -- Property CRUD --
    const openNewProp = () => { setPropForm(emptyPropForm); setEditingProp(null); setShowPropForm(true); setError(''); };
    const openEditProp = (p: Propriedade) => {
        setPropForm({
            nome: p.nome || '', endereco: p.endereco, numero: p.numero || '',
            complemento: p.complemento || '', bairro: p.bairro || '', cidade: p.cidade,
            uf: p.uf, cep: p.cep || '', administrador: p.administrador || '', observacoes: p.observacoes || '',
        });
        setEditingProp(p);
        setShowPropForm(true);
        setError('');
    };

    const handleCepBlur = async () => {
        const cep = propForm.cep.replace(/\D/g, '');
        if (cep.length !== 8) return;

        setLoadingCep(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();
            if (data.erro) {
                alert('CEP não encontrado.');
                return;
            }
            setPropForm(prev => ({
                ...prev,
                endereco: data.logradouro || prev.endereco,
                bairro: data.bairro || prev.bairro,
                cidade: data.localidade || prev.cidade,
                uf: data.uf || prev.uf,
            }));
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
        } finally {
            setLoadingCep(false);
        }
    };

    const handlePropSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true); setError('');
        try {
            let created;
            if (editingProp) {
                await api.put(`/propriedades/${editingProp.id}`, propForm);
            } else {
                created = await api.post('/propriedades', propForm);
            }
            setShowPropForm(false);
            await loadData();
            // Auto-expand newly created property to show units section
            if (created?.id) {
                setExpandedProp(created.id);
                setPropUnidades([]);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar');
        } finally { setSaving(false); }
    };
    const handleDeleteProp = async (id: string) => {
        if (!confirm('Deseja realmente remover este imóvel e todas as suas unidades?')) return;
        try { await api.delete(`/propriedades/${id}`); loadData(); if (expandedProp === id) setExpandedProp(null); }
        catch (err: unknown) { alert(err instanceof Error ? err.message : 'Erro ao remover'); }
    };

    // -- Units --
    const toggleExpand = async (propId: string) => {
        if (expandedProp === propId) { setExpandedProp(null); return; }
        setExpandedProp(propId);
        try {
            const units = await api.get(`/propriedades/${propId}/unidades`);
            setPropUnidades(units);
        } catch (err) { console.error(err); }
    };

    const openNewUnit = () => { setUnitForm(emptyUnitForm); setEditingUnit(null); setShowUnitForm(true); setUnitError(''); };
    const openEditUnit = (u: Unidade) => {
        setUnitForm({
            identificador: u.identificador, tipo_unidade: u.tipo_unidade,
            area_m2: u.area_m2 ? String(u.area_m2) : '',
            valor_sugerido: u.valor_sugerido ? String(u.valor_sugerido) : '',
            observacoes: u.observacoes || '',
        });
        setEditingUnit(u);
        setShowUnitForm(true);
        setUnitError('');
    };

    const handleUnitSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!expandedProp) return;
        setUnitSaving(true); setUnitError('');
        try {
            const payload = {
                ...unitForm,
                area_m2: unitForm.area_m2 ? parseFloat(unitForm.area_m2) : null,
                valor_sugerido: unitForm.valor_sugerido ? parseFloat(unitForm.valor_sugerido) : null
            };
            if (editingUnit) {
                await api.put(`/propriedades/unidades/${editingUnit.id}`, payload);
            } else {
                await api.post(`/propriedades/${expandedProp}/unidades`, payload);
            }
            setShowUnitForm(false);
            const units = await api.get(`/propriedades/${expandedProp}/unidades`);
            setPropUnidades(units);
            loadData();
        } catch (err: unknown) {
            setUnitError(err instanceof Error ? err.message : 'Erro ao salvar unidade');
        } finally { setUnitSaving(false); }
    };

    const handleDeleteUnit = async (unitId: string) => {
        if (!confirm('Deseja remover esta unidade?')) return;
        if (!expandedProp) return;
        try {
            await api.delete(`/propriedades/unidades/${unitId}`);
            const units = await api.get(`/propriedades/${expandedProp}/unidades`);
            setPropUnidades(units);
            loadData();
        } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Erro ao remover'); }
    };

    const unitStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            disponivel: 'bg-green-100 text-green-700',
            alugado: 'bg-blue-100 text-blue-700',
            manutencao: 'bg-yellow-100 text-yellow-700',
            inativo: 'bg-gray-100 text-gray-500',
        };
        const labels: Record<string, string> = {
            disponivel: 'Disponível', alugado: 'Alugado', manutencao: 'Manutenção', inativo: 'Inativo',
        };
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.inativo}`}>
                {labels[status] || status}
            </span>
        );
    };

    const inputClass = "w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]";

    return (
        <div className="space-y-6 pt-10 md:pt-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text)]">Imóveis</h1>
                    <p className="text-[var(--color-text-muted)] mt-1">Gerencie seus imóveis e unidades</p>
                </div>
                <button onClick={openNewProp}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold
                        hover:bg-[var(--color-primary-hover)] transition-all shadow-lg shadow-blue-500/25">
                    <Plus className="w-5 h-5" /> Novo Imóvel
                </button>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                <input type="text" placeholder="Buscar por endereço, cidade, administrador..." value={search}
                    onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--color-border)] bg-white
                        focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
            </div>

            {/* Properties List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-12 text-center text-[var(--color-text-muted)]">
                        Carregando...
                    </div>
                ) : propriedades.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-12 text-center">
                        <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-[var(--color-text-muted)]">Nenhum imóvel encontrado</p>
                    </div>
                ) : paginatedPropriedades.map(p => (
                    <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
                        {/* Property Row */}
                        <div className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                            <button onClick={() => toggleExpand(p.id)} className="p-1 rounded-lg hover:bg-gray-100">
                                {expandedProp === p.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                            </button>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-[var(--color-text)]">
                                        {p.nome || `${p.endereco}${p.numero ? `, ${p.numero}` : ''}`}
                                    </span>
                                </div>
                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                    {p.nome ? `${p.endereco}${p.numero ? `, ${p.numero}` : ''} — ` : ''}{p.cidade}/{p.uf}
                                    {p.administrador ? ` • ${p.administrador}` : ''}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-medium">
                                    <DoorOpen className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                                    {p.total_unidades} un.
                                </span>
                                {p.unidades_alugadas > 0 && (
                                    <span className="px-2.5 py-1 rounded-lg bg-green-50 text-green-700 font-medium">
                                        {p.unidades_alugadas} alugadas
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => toggleExpand(p.id)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors">
                                    <DoorOpen className="w-3.5 h-3.5" />
                                    Unidades
                                    {expandedProp === p.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => openEditProp(p)} className="p-2 rounded-lg hover:bg-blue-50 text-[var(--color-primary)]">
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeleteProp(p.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Expanded Units */}
                        {expandedProp === p.id && (
                            <div className="border-t border-[var(--color-border)] bg-gray-50/40 px-6 py-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-[var(--color-text)]">
                                        <DoorOpen className="w-4 h-4 inline -mt-0.5 mr-1" />
                                        Unidades ({propUnidades.length})
                                    </h3>
                                    <button onClick={openNewUnit}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium
                                            hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm">
                                        <Plus className="w-4 h-4" /> Unidade
                                    </button>
                                </div>

                                {propUnidades.length === 0 ? (
                                    <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
                                        Nenhuma unidade cadastrada. Adicione a primeira unidade.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
                                        <table className="w-full text-left text-sm bg-white">
                                            <thead className="bg-gray-50/80">
                                                <tr>
                                                    <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Identificador</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Tipo</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase hidden sm:table-cell">Área (m²)</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Valor Sugerido</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Status</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[var(--color-border)]">
                                                {propUnidades.map(u => (
                                                    <tr key={u.id} className="hover:bg-gray-50/50">
                                                        <td className="px-4 py-3 font-medium">{u.identificador}</td>
                                                        <td className="px-4 py-3">{u.tipo_unidade}</td>
                                                        <td className="px-4 py-3 hidden sm:table-cell">{u.area_m2 ? `${u.area_m2} m²` : '—'}</td>
                                                        <td className="px-4 py-3">{u.valor_sugerido ? `R$ ${u.valor_sugerido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</td>
                                                        <td className="px-4 py-3">{unitStatusBadge(u.status)}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-1">
                                                                <button onClick={() => openEditUnit(u)} className="p-1.5 rounded-lg hover:bg-blue-50 text-[var(--color-primary)]">
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => handleDeleteUnit(u.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {/* Pagination */}
                <div className="pt-4">
                    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>
            </div>

            {/* Property Form Modal */}
            {showPropForm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                            <h2 className="text-xl font-bold">{editingProp ? 'Editar Imóvel' : 'Novo Imóvel'}</h2>
                            <button onClick={() => setShowPropForm(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handlePropSubmit} className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Nome do Imóvel</label>
                                <input type="text" value={propForm.nome} onChange={e => setPropForm({ ...propForm, nome: e.target.value })}
                                    placeholder="Ex: Edifício Centro, Galeria Norte..." className={inputClass} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Endereço *</label>
                                    <input type="text" value={propForm.endereco} onChange={e => setPropForm({ ...propForm, endereco: e.target.value })}
                                        placeholder="Rua, Avenida..." required className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Número</label>
                                    <input type="text" value={propForm.numero} onChange={e => setPropForm({ ...propForm, numero: e.target.value })}
                                        placeholder="Nº" className={inputClass} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Complemento</label>
                                    <input type="text" value={propForm.complemento} onChange={e => setPropForm({ ...propForm, complemento: e.target.value })}
                                        placeholder="Bloco..." className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Bairro</label>
                                    <input type="text" value={propForm.bairro} onChange={e => setPropForm({ ...propForm, bairro: e.target.value })}
                                        placeholder="Bairro" className={inputClass} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Cidade *</label>
                                    <input type="text" value={propForm.cidade} onChange={e => setPropForm({ ...propForm, cidade: e.target.value })}
                                        placeholder="Cidade" required className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">UF *</label>
                                    <select value={propForm.uf} onChange={e => setPropForm({ ...propForm, uf: e.target.value })} required className={inputClass}>
                                        <option value="">Selecione</option>
                                        {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">CEP</label>
                                    <div className="relative">
                                        <input type="text" value={propForm.cep}
                                            onChange={e => setPropForm({ ...propForm, cep: maskCEP(e.target.value) })}
                                            onBlur={handleCepBlur}
                                            placeholder="00000-000" maxLength={9} className={inputClass} />
                                        {loadingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Administrador</label>
                                <input type="text" value={propForm.administrador} onChange={e => setPropForm({ ...propForm, administrador: e.target.value })}
                                    placeholder="Nome do administrador" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Observações</label>
                                <textarea value={propForm.observacoes} onChange={e => setPropForm({ ...propForm, observacoes: e.target.value })}
                                    rows={3} placeholder="Observações sobre o imóvel..." className={`${inputClass} resize-none`} />
                            </div>
                            {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200"><p className="text-red-600 text-sm">{error}</p></div>}
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowPropForm(false)}
                                    className="px-6 py-3 rounded-xl border border-[var(--color-border)] font-medium hover:bg-gray-50">Cancelar</button>
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

            {/* Unit Form Modal */}
            {showUnitForm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                            <h2 className="text-lg font-bold">{editingUnit ? 'Editar Unidade' : 'Nova Unidade'}</h2>
                            <button onClick={() => setShowUnitForm(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleUnitSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Identificador *</label>
                                <input type="text" value={unitForm.identificador} onChange={e => setUnitForm({ ...unitForm, identificador: e.target.value })}
                                    required placeholder="Ex: Apt 101, Loja 3, Sala 205..." className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Tipo *</label>
                                <select value={unitForm.tipo_unidade} onChange={e => setUnitForm({ ...unitForm, tipo_unidade: e.target.value })}
                                    required className={inputClass}>
                                    {TIPOS_UNIDADE.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Área (m²)</label>
                                <input type="number" step="0.01" value={unitForm.area_m2} onChange={e => setUnitForm({ ...unitForm, area_m2: e.target.value })}
                                    placeholder="Ex: 45.5" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Valor Sugerido (R$)</label>
                                <input type="number" step="0.01" value={unitForm.valor_sugerido} onChange={e => setUnitForm({ ...unitForm, valor_sugerido: e.target.value })}
                                    placeholder="Ex: 1200.00" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Observações</label>
                                <textarea value={unitForm.observacoes} onChange={e => setUnitForm({ ...unitForm, observacoes: e.target.value })}
                                    rows={2} placeholder="Observações da unidade..." className={`${inputClass} resize-none`} />
                            </div>
                            {unitError && <div className="p-3 rounded-xl bg-red-50 border border-red-200"><p className="text-red-600 text-sm">{unitError}</p></div>}
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowUnitForm(false)}
                                    className="px-5 py-2.5 rounded-xl border border-[var(--color-border)] font-medium hover:bg-gray-50 text-sm">Cancelar</button>
                                <button type="submit" disabled={unitSaving}
                                    className="px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white font-semibold text-sm
                                        hover:bg-[var(--color-primary-hover)] disabled:opacity-50 shadow-lg shadow-blue-500/25">
                                    {unitSaving ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
