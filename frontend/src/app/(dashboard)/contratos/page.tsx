'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AlertModal from '@/components/ui/AlertModal';
import InstallmentGenerationModal from '@/components/InstallmentGenerationModal';
import { Pagination } from '@/components/ui/Pagination';
import {
    Plus, Search, Eye, X, FileText, AlertTriangle,
    CheckCircle, Clock, Ban, Printer, RefreshCw, DollarSign, CalendarPlus, Trash2, Pencil, Download
} from 'lucide-react';
import { Combobox } from '@/components/ui/Combobox';
import ContractDetailModal from '@/components/ContractDetailModal';

interface Contrato {
    id: string;
    inquilino_id: string;
    unidade_id: string;
    inquilino_nome: string;
    inquilino_cpf: string;
    inquilino_restricoes: string;
    unidade_identificador: string;
    tipo_unidade: string;
    imovel_endereco: string;
    imovel_numero: string;
    imovel_cidade: string;
    imovel_nome: string;
    data_inicio: string;
    data_fim: string;
    qtd_ocupantes: number;
    valor_inicial: number;
    dia_vencimento: number;
    status_encerrado: boolean;
    observacoes_contrato: string;
    parcelas?: Parcela[];
}

interface Parcela {
    id: string;
    numero_parcela: number;
    periodo_inicio: string;
    periodo_fim: string;
    valor_base: number;
    desconto_pontualidade: number;
    data_vencimento: string;
    data_pagamento: string | null;
    valor_pago: number | null;
    status_pagamento: string;
    valor_iptu: number;
    valor_agua: number;
    valor_luz: number;
    valor_outros: number;
    descricao?: string;
}

interface Inquilino {
    id: string;
    nome_completo: string;
    cpf: string;
    restricoes: string;
}

interface Propriedade {
    id: string;
    nome: string;
    endereco: string;
    numero: string;
    cidade: string;
    uf: string;
}

interface Unidade {
    id: string;
    propriedade_id: string;
    identificador: string;
    tipo_unidade: string;
    status: string;
    valor_sugerido?: number;
}

interface PaginatedResponse {
    data: Contrato[];
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
    inquilino_id: '', unidade_id: '', data_inicio: '', data_fim: '',
    qtd_ocupantes: '1', valor_inicial: '', dia_vencimento: '10', observacoes_contrato: '',
    valor_iptu: '', valor_agua: '', valor_luz: '', valor_outros: ''
};

const emptyStandaloneForm = {
    unidade_id: '', inquilino_id: '', descricao: '', data_vencimento: '',
    valor_base: '', valor_iptu: '', valor_agua: '', valor_luz: '', valor_outros: '',
    observacoes: ''
};

export default function ContratosPage() {
    const [paginationData, setPaginationData] = useState<PaginatedResponse | null>(null);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [inquilinos, setInquilinos] = useState<Inquilino[]>([]);
    const [propriedades, setPropriedades] = useState<Propriedade[]>([]);
    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [selectedPropId, setSelectedPropId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [alertState, setAlertState] = useState<{ title: string, message: string, type: 'success' | 'danger' | 'warning' | 'info' } | null>(null);

    const showAlert = (title: string, message: string, type: 'success' | 'danger' | 'warning' | 'info') => {
        setAlertState({ title, message, type });
    };

    const [modal, setModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'danger' as 'danger' | 'warning' | 'info',
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        showCancel: true
    });

    const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'info' = 'danger') => {
        setModal({
            isOpen: true,
            title,
            message,
            onConfirm: async () => {
                await onConfirm();
                setModal(prev => ({ ...prev, isOpen: false }));
            },
            type,
            confirmText: 'Confirmar',
            cancelText: 'Cancelar',
            showCancel: true
        });
    };

    // Standalone
    const [showStandaloneForm, setShowStandaloneForm] = useState(false);
    const [standaloneForm, setStandaloneForm] = useState(emptyStandaloneForm);

    // Modal State
    // Renewal State
    const [showRenewModal, setShowRenewModal] = useState(false);
    const [renewForm, setRenewForm] = useState({
        nova_data_fim: '',
        novo_valor: '',
        indice_reajuste: '',
        observacoes: ''
    });

    // Edit State
    const [editingContract, setEditingContract] = useState<Contrato | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [genModal, setGenModal] = useState({ isOpen: false, contractId: '', contractValue: 0 });

    useEffect(() => {
        loadContratos();
        fetchLists();
    }, [currentPage, itemsPerPage, search]);

    const loadContratos = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', currentPage.toString());
            params.set('limit', itemsPerPage.toString());

            const response = await api.get(`/contratos?${params.toString()}`);
            setPaginationData(response);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const contratos = paginationData?.data || [];
    const pagination = paginationData?.pagination;



    const openNew = () => {
        setForm(emptyForm);
        setEditingContract(null);
        setSelectedPropId('');
        fetchLists().then(() => setShowForm(true));
    };

    const openStandalone = () => {
        setStandaloneForm(emptyStandaloneForm);
        setSelectedPropId('');
        fetchLists().then(() => setShowStandaloneForm(true));
    };

    const handleSelectProperty = async (propId: string) => {
        setSelectedPropId(propId);
        setForm(prev => ({ ...prev, unidade_id: '' }));
        setStandaloneForm(prev => ({ ...prev, unidade_id: '' }));
        if (!propId) {
            setUnidades([]);
            return;
        }
        try {
            const units = await api.get(`/propriedades/${propId}/unidades`);
            setUnidades(units);
        } catch (err) {
            console.error('Error fetching units:', err);
            setUnidades([]);
        }
    };

    const handleSelectUnit = (unitId: string) => {
        const unit = unidades.find(u => String(u.id) === String(unitId));
        setForm(prev => ({
            ...prev,
            unidade_id: unitId,
            valor_inicial: unit?.valor_sugerido ? String(unit.valor_sugerido) : prev.valor_inicial
        }));
    };

    const handleStandaloneSelectUnit = (unitId: string) => {
        const unit = unidades.find(u => String(u.id) === String(unitId));
        setStandaloneForm(prev => ({
            ...prev,
            unidade_id: unitId,
            valor_base: unit?.valor_sugerido ? String(unit.valor_sugerido) : prev.valor_base
        }));
    };

    const viewDetail = (id: string) => {
        setSelectedContractId(id);
        setIsDetailModalOpen(true);
    };

    const selectedTenant = inquilinos.find(i => String(i.id) === String(form.inquilino_id));


    const fetchLists = async () => {
        try {
            const [inqRes, propRes] = await Promise.all([
                api.get('/inquilinos'),
                api.get('/propriedades')
            ]);
            setInquilinos(Array.isArray(inqRes) ? inqRes : inqRes.data || []);
            setPropriedades(Array.isArray(propRes) ? propRes : propRes.data || []);
            setUnidades([]); // Clear units, they will be fetched on property selection
        } catch (err) {
            console.error('Error fetching lists:', err);
        }
    };

    const openRenewModal = (c: Contrato) => {
        setRenewForm({
            nova_data_fim: '', // User must pick
            novo_valor: c.valor_inicial.toString(),
            indice_reajuste: '',
            observacoes: ''
        });
        setShowRenewModal(true);
    };

    const handleRenewSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedContractId) return;
        setSaving(true);
        try {
            await api.post(`/contratos/${selectedContractId}/renovar`, {
                ...renewForm,
                novo_valor: parseFloat(renewForm.novo_valor)
            });
            if (isDetailModalOpen) {
                // The modal will refresh itself if we trigger it or if it fetches on render
            }
            setShowRenewModal(false);
            loadContratos();
            showAlert('Sucesso', 'Contrato renovado com sucesso!', 'success');
        } catch (err: unknown) {
            showAlert('Erro', err instanceof Error ? err.message : 'Erro ao renovar', 'danger');
        } finally {
            setSaving(false);
        }
    };

    // Edit Logic
    const openEdit = (c: Contrato) => {
        setForm({
            inquilino_id: c.inquilino_id,
            unidade_id: c.unidade_id,
            data_inicio: c.data_inicio.split('T')[0],
            data_fim: c.data_fim.split('T')[0],
            qtd_ocupantes: String(c.qtd_ocupantes),
            valor_inicial: String(c.valor_inicial),
            dia_vencimento: String(c.dia_vencimento),
            observacoes_contrato: c.observacoes_contrato || '',
            valor_iptu: '', // TODO: These are not in the main contract object in list view, might need detail fetch if not available
            valor_agua: '',
            valor_luz: '',
            valor_outros: ''
            // Note: Breakdown values are usually hidden in main table list. 
            // If the user wants to edit breakdown, they might need to do it via a specialized breakdown edit or we fetch detail first.
            // For now, let's pre-fill with defaults or if we have them. 
            // Actually, fetch detail first if not present? 
            // Simpler: Just allow editing the main fields in the form for now.
        });
        // Retrieve full details to fill breakdown?
        // Let's rely on showDetail or fetch it specifically if needed.
        // For simplicity, I'll just open the form. If values are empty, they might overwrite with 0 on save if we are not careful.
        // Let's fetch the full contract data to populate the edit form correctly.
        api.get(`/contratos/${c.id}`).then(fullData => {
            setForm({
                inquilino_id: fullData.inquilino_id,
                unidade_id: fullData.unidade_id,
                data_inicio: fullData.data_inicio ? fullData.data_inicio.split('T')[0] : '',
                data_fim: fullData.data_fim ? fullData.data_fim.split('T')[0] : '',
                qtd_ocupantes: String(fullData.qtd_ocupantes),
                valor_inicial: String(fullData.valor_inicial),
                dia_vencimento: String(fullData.dia_vencimento),
                observacoes_contrato: fullData.observacoes_contrato || '',
                valor_iptu: String(fullData.valor_iptu || 0),
                valor_agua: String(fullData.valor_agua || 0),
                valor_luz: String(fullData.valor_luz || 0),
                valor_outros: String(fullData.valor_outros || 0)
            });
            setEditingContract(fullData);
            setSelectedPropId(''); // Reset or find property? 
            // In layout, we select property then unit. Pre-filling this properly is complex as we don't know propID easily without lookup.
            // But we can just set form and ensure unidades list is loaded if user changes it.
            // For now, let's just show form. If user wants to change unit, they start over selecting property.
            // Also ensure we have the lists
            fetchLists().then(() => setShowForm(true));
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload = {
                ...form,
                qtd_ocupantes: parseInt(form.qtd_ocupantes),
                valor_inicial: parseFloat(form.valor_inicial),
                dia_vencimento: parseInt(form.dia_vencimento),
                valor_iptu: form.valor_iptu ? parseFloat(form.valor_iptu) : 0,
                valor_agua: form.valor_agua ? parseFloat(form.valor_agua) : 0,
                valor_luz: form.valor_luz ? parseFloat(form.valor_luz) : 0,
                valor_outros: form.valor_outros ? parseFloat(form.valor_outros) : 0,
            };

            if (editingContract) {
                await api.put(`/contratos/${editingContract.id}`, payload);
                showAlert('Sucesso', 'Contrato atualizado com sucesso!', 'success');
            } else {
                await api.post('/contratos', payload);
                showAlert('Sucesso', 'Contrato criado com sucesso!', 'success');
            }
            setShowForm(false);
            loadContratos();
            if (isDetailModalOpen && selectedContractId === editingContract?.id) {
                // Modal handles refresh via local state or we could pass a refresh trigger
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar');
        } finally { setSaving(false); }
    };

    const handleStandaloneSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true); setError('');
        try {
            await api.post('/contratos/parcelas/avulso', {
                ...standaloneForm,
                valor_base: standaloneForm.valor_base ? parseFloat(standaloneForm.valor_base) : 0,
                valor_iptu: standaloneForm.valor_iptu ? parseFloat(standaloneForm.valor_iptu) : 0,
                valor_agua: standaloneForm.valor_agua ? parseFloat(standaloneForm.valor_agua) : 0,
                valor_luz: standaloneForm.valor_luz ? parseFloat(standaloneForm.valor_luz) : 0,
                valor_outros: standaloneForm.valor_outros ? parseFloat(standaloneForm.valor_outros) : 0,
            });
            setShowStandaloneForm(false);
            setShowStandaloneForm(false);
            showAlert('Sucesso', 'Cobrança avulsa criada com sucesso!', 'success');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro ao criar cobrança');
        } finally { setSaving(false); }
    };

    const handleEncerrar = async (id: string) => {
        showConfirm('Encerrar Contrato', 'Deseja realmente encerrar este contrato? Todas as parcelas pendentes serão canceladas.', async () => {
            try {
                await api.patch(`/contratos/${id}/encerrar`, {});
                loadContratos();
                if (selectedContractId === id) setIsDetailModalOpen(false);
                showAlert('Contrato Encerrado', 'O contrato foi encerrado com sucesso.', 'success');
            } catch (err: unknown) {
                showAlert('Erro', err instanceof Error ? err.message : 'Erro ao encerrar', 'danger');
            }
        }, 'danger');
    };

    const handlePagarParcela = async (parcelaId: string) => {
        try {
            const today = new Date().toISOString().split('T')[0];
            await api.patch(`/contratos/parcelas/${parcelaId}`, {
                status_pagamento: 'pago',
                data_pagamento: today,
            });
            // Refresh handled by modal
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Erro ao registrar pagamento');
        }
    };

    const openGenerationModal = (contrato: Contrato) => {
        setGenModal({
            isOpen: true,
            contractId: contrato.id,
            contractValue: contrato.valor_inicial
        });
    };

    const handleConfirmGeneration = async (mode: 'next' | 'manual' | 'all', dataVencimento?: string, valor?: string) => {
        setSaving(true);
        try {
            await api.post(`/contratos/${genModal.contractId}/parcelas/gerar`, {
                mode,
                data_vencimento: dataVencimento,
                valor: valor ? parseFloat(valor) : undefined
            });
            // Refresh handled by modal or re-fetching
            showAlert('Sucesso', 'Parcelas geradas com sucesso!', 'success');
        } catch (err: unknown) {
            showAlert('Erro', err instanceof Error ? err.message : 'Erro ao gerar parcela', 'danger');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteParcela = async (parcelaId: string) => {
        showConfirm('Excluir Parcela', 'Tem certeza que deseja excluir esta parcela?', async () => {
            try {
                await api.delete(`/contratos/parcelas/${parcelaId}`);
                // Refresh handled by modal
                showAlert('Sucesso', 'Parcela removida com sucesso!', 'success');
            } catch (err: unknown) {
                showAlert('Erro', err instanceof Error ? err.message : 'Erro ao remover parcela', 'danger');
            }
        }, 'danger');
    };

    const parcelaStatusIcon = (status: string) => {
        switch (status) {
            case 'pago': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'atrasado': return <AlertTriangle className="w-4 h-4 text-red-500" />;
            case 'cancelado': return <Ban className="w-4 h-4 text-gray-400" />;
            default: return <Clock className="w-4 h-4 text-yellow-500" />;
        }
    };

    const parcelaStatusLabel = (status: string) => {
        const map: Record<string, string> = { pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado', cancelado: 'Cancelado' };
        return map[status] || status;
    };

    const formatDate = (d: string) => {
        if (!d) return '—';
        // Handle ISO strings that might or might not have time
        const datePart = d.includes('T') ? d.split('T')[0] : d;
        try {
            const [year, month, day] = datePart.split('-');
            const date = new Date(Number(year), Number(month) - 1, Number(day));
            if (isNaN(date.getTime())) return 'Data Inválida';
            return date.toLocaleDateString('pt-BR');
        } catch (e) {
            return '—';
        }
    };

    const formatCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    // Helper to calculate total parcel value
    const getParcelaTotal = (p: Parcela) => {
        return (Number(p.valor_base) || 0) +
            (Number(p.valor_iptu) || 0) +
            (Number(p.valor_agua) || 0) +
            (Number(p.valor_luz) || 0) +
            (Number(p.valor_outros) || 0);
    };

    const inputClass = "w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]";

    return (
        <div className="space-y-6 pt-10 md:pt-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text)]">Contratos</h1>
                    <p className="text-[var(--color-text-muted)] mt-1">Gerencie os contratos de aluguel</p>
                </div>
                <button onClick={openNew}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold
            hover:bg-[var(--color-primary-hover)] transition-all shadow-lg shadow-blue-500/25">
                    <Plus className="w-5 h-5" /> Novo Contrato
                </button>

            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                <input type="text" placeholder="Buscar por inquilino, imóvel ou unidade..." value={search}
                    onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--color-border)] bg-white
            focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/80">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Inquilino</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider hidden md:table-cell">Unidade</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider hidden lg:table-cell">Período</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Valor</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-[var(--color-text-muted)]">Carregando...</td></tr>
                            ) : contratos.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-[var(--color-text-muted)]">Nenhum contrato encontrado</p>
                                    </td>
                                </tr>
                            ) : contratos.map(c => (
                                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{c.inquilino_nome}</span>
                                            {c.inquilino_restricoes && (
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">
                                                    <AlertTriangle className="w-3 h-3" />
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm hidden md:table-cell">
                                        <span className="font-medium">{c.unidade_identificador}</span>
                                        <span className="text-[var(--color-text-muted)]"> — {c.imovel_endereco}{c.imovel_numero ? `, ${c.imovel_numero}` : ''}</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm hidden lg:table-cell">
                                        {formatDate(c.data_inicio)} — {formatDate(c.data_fim)}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium">{formatCurrency(c.valor_inicial)}</td>
                                    <td className="px-6 py-4">
                                        {c.status_encerrado
                                            ? <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Encerrado</span>
                                            : <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Ativo</span>
                                        }
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => window.open(`/api/relatorios/contrato/${c.id}`, '_blank')}
                                                className="p-2 rounded-lg hover:bg-green-50 text-green-600"
                                                title="Baixar PDF do Contrato"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => viewDetail(c.id)} className="p-2 rounded-lg hover:bg-blue-50 text-[var(--color-primary)]">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => openEdit(c)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600" title="Editar">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            {!c.status_encerrado && (
                                                <button onClick={() => handleEncerrar(c.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500">
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                <div className="p-4 border-t border-[var(--color-border)]">
                    {pagination && (
                        <Pagination
                            currentPage={pagination.page}
                            totalPages={pagination.totalPages}
                            onPageChange={setCurrentPage}
                            onLimitChange={setItemsPerPage}
                        />
                    )}
                </div>
            </div>

            {/* New Contract Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                            <h2 className="text-xl font-bold">{editingContract ? 'Editar Contrato' : 'Novo Contrato'}</h2>
                            <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Tenant Selection */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Inquilino *</label>
                                <Combobox
                                    options={inquilinos.map(i => ({
                                        id: i.id,
                                        label: `${i.nome_completo} — ${i.cpf}${i.restricoes ? ' ⚠️' : ''}`
                                    }))}
                                    value={form.inquilino_id}
                                    onChange={val => setForm({ ...form, inquilino_id: String(val) })}
                                    placeholder="Selecione o inquilino"
                                    required
                                />
                                {selectedTenant?.restricoes && (
                                    <div className="mt-2 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
                                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-semibold text-red-700">Atenção: Inquilino com restrições!</p>
                                            <p className="text-sm text-red-600 mt-0.5">{selectedTenant.restricoes}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Property → Unit Selection (cascading) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Imóvel *</label>
                                    <Combobox
                                        options={propriedades.map(p => ({
                                            id: p.id,
                                            label: (p.nome ? `${p.nome} — ` : '') + p.endereco + (p.numero ? `, ${p.numero}` : '') + ` — ${p.cidade}/${p.uf}`
                                        }))}
                                        value={selectedPropId}
                                        onChange={val => handleSelectProperty(String(val))}
                                        placeholder="Selecione o imóvel"
                                        required
                                    />
                                </div>
                                {selectedPropId && unidades.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Unidade *</label>
                                        <Combobox
                                            options={unidades.map(u => ({
                                                id: u.id,
                                                label: `${u.identificador} (${u.tipo_unidade})${u.status === 'alugado' ? ' — Alugado' : ''}`,
                                                disabled: u.status === 'alugado'
                                            }))}
                                            value={form.unidade_id}
                                            onChange={val => handleSelectUnit(String(val))}
                                            placeholder="Selecione a unidade"
                                            required
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Data Início *</label>
                                    <input type="date" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} required className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Data Fim *</label>
                                    <input type="date" value={form.data_fim} onChange={e => setForm({ ...form, data_fim: e.target.value })} required className={inputClass} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Valor Mensal (R$) *</label>
                                    <input type="number" step="0.01" value={form.valor_inicial}
                                        onChange={e => setForm({ ...form, valor_inicial: e.target.value })} required placeholder="0,00" className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Dia Vencimento *</label>
                                    <input type="number" min="1" max="31" value={form.dia_vencimento}
                                        onChange={e => setForm({ ...form, dia_vencimento: e.target.value })} required className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Qtd. Ocupantes</label>
                                    <input type="number" min="1" value={form.qtd_ocupantes}
                                        onChange={e => setForm({ ...form, qtd_ocupantes: e.target.value })} className={inputClass} />
                                </div>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl space-y-4 border border-[var(--color-border)]">
                                <h3 className="font-semibold text-[var(--color-text)] flex items-center gap-2">
                                    <DollarSign className="w-4 h-4" /> Despesas Mensais (Estimativa)
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">IPTU</label>
                                        <input type="number" step="0.01" value={form.valor_iptu}
                                            onChange={e => setForm({ ...form, valor_iptu: e.target.value })} placeholder="0,00" className={inputClass} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Água (Fixo)</label>
                                        <input type="number" step="0.01" value={form.valor_agua}
                                            onChange={e => setForm({ ...form, valor_agua: e.target.value })} placeholder="0,00" className={inputClass} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Luz (Fixo)</label>
                                        <input type="number" step="0.01" value={form.valor_luz}
                                            onChange={e => setForm({ ...form, valor_luz: e.target.value })} placeholder="0,00" className={inputClass} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Outros</label>
                                        <input type="number" step="0.01" value={form.valor_outros}
                                            onChange={e => setForm({ ...form, valor_outros: e.target.value })} placeholder="0,00" className={inputClass} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Observações</label>
                                <textarea value={form.observacoes_contrato} onChange={e => setForm({ ...form, observacoes_contrato: e.target.value })}
                                    rows={3} placeholder="Observações do contrato..." className={`${inputClass} resize-none`} />
                            </div>

                            {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200"><p className="text-red-600 text-sm">{error}</p></div>}

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowForm(false)}
                                    className="px-6 py-3 rounded-xl border border-[var(--color-border)] font-medium hover:bg-gray-50">Cancelar</button>
                                <button type="submit" disabled={saving}
                                    className="px-6 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold
                    hover:bg-[var(--color-primary-hover)] disabled:opacity-50 shadow-lg shadow-blue-500/25">
                                    {saving ? 'Salvando...' : (editingContract ? 'Salvar Alterações' : 'Criar Contrato')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Contract Detail Modal */}
            <ContractDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                contractId={selectedContractId}
            />

            {/* Standalone Charge Modal */}
            {
                showStandaloneForm && (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                                <h2 className="text-xl font-bold">Nova Cobrança Avulsa</h2>
                                <button onClick={() => setShowStandaloneForm(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={handleStandaloneSubmit} className="p-6 space-y-6">
                                {/* Property → Unit Selection (cascading) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Imóvel *</label>
                                        <Combobox
                                            options={propriedades.map(p => ({
                                                id: p.id,
                                                label: (p.nome ? `${p.nome} — ` : '') + p.endereco
                                            }))}
                                            value={selectedPropId}
                                            onChange={val => handleSelectProperty(String(val))}
                                            placeholder="Selecione o imóvel"
                                            required
                                        />
                                    </div>
                                    {selectedPropId && unidades.length > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Unidade *</label>
                                            <Combobox
                                                options={unidades.map(u => ({
                                                    id: u.id,
                                                    label: `${u.identificador} (${u.tipo_unidade})`
                                                }))}
                                                value={standaloneForm.unidade_id}
                                                onChange={val => handleStandaloneSelectUnit(String(val))}
                                                placeholder="Selecione a unidade"
                                                required
                                            />
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Inquilino (Opcional)</label>
                                    <Combobox
                                        options={inquilinos.map(i => ({ id: i.id, label: i.nome_completo }))}
                                        value={standaloneForm.inquilino_id}
                                        onChange={val => setStandaloneForm({ ...standaloneForm, inquilino_id: String(val) })}
                                        placeholder="Selecione o inquilino"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Descrição *</label>
                                        <input type="text" value={standaloneForm.descricao} onChange={e => setStandaloneForm({ ...standaloneForm, descricao: e.target.value })}
                                            required placeholder="Ex: Multa, Conserto..." className={inputClass} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Vencimento *</label>
                                        <input type="date" value={standaloneForm.data_vencimento} onChange={e => setStandaloneForm({ ...standaloneForm, data_vencimento: e.target.value })}
                                            required className={inputClass} />
                                    </div>
                                </div>

                                <div className="bg-gray-50 p-4 rounded-xl space-y-4 border border-[var(--color-border)]">
                                    <h3 className="font-semibold text-[var(--color-text)] flex items-center gap-2">
                                        <DollarSign className="w-4 h-4" /> Valores
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Aluguel/Base</label>
                                            <input type="number" step="0.01" value={standaloneForm.valor_base}
                                                onChange={e => setStandaloneForm({ ...standaloneForm, valor_base: e.target.value })} placeholder="0,00" className={inputClass} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">IPTU</label>
                                            <input type="number" step="0.01" value={standaloneForm.valor_iptu}
                                                onChange={e => setStandaloneForm({ ...standaloneForm, valor_iptu: e.target.value })} placeholder="0,00" className={inputClass} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Água</label>
                                            <input type="number" step="0.01" value={standaloneForm.valor_agua}
                                                onChange={e => setStandaloneForm({ ...standaloneForm, valor_agua: e.target.value })} placeholder="0,00" className={inputClass} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Luz</label>
                                            <input type="number" step="0.01" value={standaloneForm.valor_luz}
                                                onChange={e => setStandaloneForm({ ...standaloneForm, valor_luz: e.target.value })} placeholder="0,00" className={inputClass} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Outros</label>
                                            <input type="number" step="0.01" value={standaloneForm.valor_outros}
                                                onChange={e => setStandaloneForm({ ...standaloneForm, valor_outros: e.target.value })} placeholder="0,00" className={inputClass} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Observações</label>
                                    <textarea value={standaloneForm.observacoes} onChange={e => setStandaloneForm({ ...standaloneForm, observacoes: e.target.value })}
                                        rows={2} className={`${inputClass} resize-none`} />
                                </div>

                                {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200"><p className="text-red-600 text-sm">{error}</p></div>}

                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setShowStandaloneForm(false)}
                                        className="px-6 py-3 rounded-xl border border-[var(--color-border)] font-medium hover:bg-gray-50">Cancelar</button>
                                    <button type="submit" disabled={saving}
                                        className="px-6 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold
                                        hover:bg-[var(--color-primary-hover)] disabled:opacity-50 shadow-lg shadow-purple-500/25">
                                        {saving ? 'Salvando...' : 'Criar Cobrança'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* Modal de Alerta/Confirmacao */}
            <ConfirmModal
                isOpen={modal.isOpen}
                onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={modal.onConfirm}
                title={modal.title}
                message={modal.message}
                type={modal.type}
                confirmText={modal.confirmText}
                cancelText={modal.cancelText}
                showCancel={modal.showCancel}
            />

            <AlertModal
                isOpen={!!alertState}
                onClose={() => setAlertState(null)}
                title={alertState?.title || ''}
                message={alertState?.message || ''}
                type={alertState?.type || 'info'}
            />
            {/* Generation Modal */}
            <InstallmentGenerationModal
                isOpen={genModal.isOpen}
                onClose={() => setGenModal({ ...genModal, isOpen: false })}
                onConfirm={handleConfirmGeneration}
                contractValue={genModal.contractValue}
            />

            {/* Renewal Modal */}
            {showRenewModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                            <h2 className="text-xl font-bold">Renovar Contrato</h2>
                            <button onClick={() => setShowRenewModal(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleRenewSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Nova Data Fim *</label>
                                <input type="date" value={renewForm.nova_data_fim} onChange={e => setRenewForm({ ...renewForm, nova_data_fim: e.target.value })}
                                    required className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Novo Valor (R$) *</label>
                                <input type="number" step="0.01" value={renewForm.novo_valor} onChange={e => setRenewForm({ ...renewForm, novo_valor: e.target.value })}
                                    required className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Índice Reajuste</label>
                                <input type="text" value={renewForm.indice_reajuste} onChange={e => setRenewForm({ ...renewForm, indice_reajuste: e.target.value })}
                                    placeholder="Ex: IGPM 10%" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Observações</label>
                                <textarea value={renewForm.observacoes} onChange={e => setRenewForm({ ...renewForm, observacoes: e.target.value })}
                                    rows={3} className={`${inputClass} resize-none`} placeholder="Observações sobre a renovação..." />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowRenewModal(false)}
                                    className="px-4 py-2 rounded-lg border border-[var(--color-border)] hover:bg-gray-50">Cancelar</button>
                                <button type="submit" disabled={saving}
                                    className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
                                    {saving ? 'Salvando...' : 'Confirmar Renovação'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div >
    );
}
