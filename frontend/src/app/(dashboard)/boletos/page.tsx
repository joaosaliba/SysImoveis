'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Pagination } from '@/components/ui/Pagination';
import AlertModal from '@/components/ui/AlertModal';
import { Search, Printer, Calendar, Filter, FileText, CheckSquare, Square, CheckCircle, AlertTriangle, Clock, Ban, RefreshCw, DollarSign, Pencil, Download } from 'lucide-react';
import { format } from 'date-fns';
import BulkActionModal from '@/components/BulkActionModal';
import ParcelaModal from '@/components/ParcelaModal';
import { Combobox } from '@/components/ui/Combobox';
import ContractDetailModal from '@/components/ContractDetailModal';

interface Parcela {
    id: string;
    contrato_id?: string;
    inquilino_id?: string;
    unidade_id?: string;
    inquilino_nome: string;
    imovel_nome: string;
    imovel_endereco: string;
    unidade_identificador: string;
    data_vencimento: string;
    valor_base: string; // numeric string
    valor_iptu: string;
    valor_agua: string;
    valor_luz: string;
    valor_outros: string | number;
    desconto_pontualidade: string | number;
    status_pagamento: string;
    numero_parcela: number;
    descricao?: string;
    observacoes?: string;
}

interface Propriedade { id: string; nome: string; endereco: string; }
interface Inquilino { id: string; nome_completo: string; }

export default function BoletosPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Carregando...</div>}>
            <BoletosContent />
        </Suspense>
    );
}

function BoletosContent() {
    const searchParams = useSearchParams();
    const statusParam = searchParams.get('status');

    // Filters
    const [dtInicio, setDtInicio] = useState(
        statusParam === 'atrasado'
            ? '2000-01-01'
            : format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-01')
    ); // Start of current year, or far past for overdue
    const [dtFim, setDtFim] = useState(format(new Date(new Date().getFullYear() + 1, 11, 31), 'yyyy-MM-dd')); // End of next year
    const [status, setStatus] = useState(statusParam || 'pendente');
    const [imovelId, setImovelId] = useState('');
    const [inquilinoId, setInquilinoId] = useState('');

    // Data
    const [parcelas, setParcelas] = useState<Parcela[]>([]);
    const [propriedades, setPropriedades] = useState<Propriedade[]>([]);
    const [inquilinos, setInquilinos] = useState<Inquilino[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState<{ title: string, message: string, type: 'success' | 'danger' | 'warning' } | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20; // More items for invoices usually

    useEffect(() => {
        api.get('/propriedades').then(res => setPropriedades(Array.isArray(res) ? res : res.data || [])).catch(console.error);
        api.get('/inquilinos').then(res => setInquilinos(Array.isArray(res) ? res : res.data || [])).catch(console.error);
    }, []);

    const loadParcelas = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                dt_inicio: dtInicio,
                dt_fim: dtFim,
                status,
                ...(imovelId && { imovel_id: imovelId }),
                ...(inquilinoId && { inquilino_id: inquilinoId })
            });
            const data = await api.get(`/contratos/parcelas/filtro?${params}`);
            setParcelas(Array.isArray(data) ? data : data.data || []);
            setSelectedIds(new Set()); // Reset selection on filter change
            setCurrentPage(1); // Reset page on filter change
        } catch (err: unknown) {
            console.error(err);
            setAlert({
                title: 'Erro',
                message: err instanceof Error ? err.message : 'Erro ao buscar boletos',
                type: 'danger'
            });
        } finally {
            setLoading(false);
        }
    }, [dtInicio, dtFim, status, imovelId, inquilinoId]);

    // Auto-load on filter change
    useEffect(() => { loadParcelas(); }, [loadParcelas]);

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        const visibleIds = paginatedParcelas.map(p => p.id);
        const allVisibleSelected = visibleIds.every(id => selectedIds.has(id));

        const newSet = new Set(selectedIds);

        if (allVisibleSelected) {
            // Unselect all visible
            visibleIds.forEach(id => newSet.delete(id));
        } else {
            // Select all visible
            visibleIds.forEach(id => newSet.add(id));
        }
        setSelectedIds(newSet);
    };

    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    // Parcela Modal State
    const [isParcelaModalOpen, setIsParcelaModalOpen] = useState(false);
    const [editingParcela, setEditingParcela] = useState<Parcela | null>(null);

    // Contract Detail Modal State
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

    const openContractDetail = (id: string) => {
        setSelectedContractId(id);
        setIsDetailModalOpen(true);
    };

    const openNewParcela = () => {
        setEditingParcela(null);
        setIsParcelaModalOpen(true);
    };

    const openEditParcela = (parcela: Parcela) => {
        setEditingParcela(parcela);
        setIsParcelaModalOpen(true);
    };

    const handleBulkActionClick = () => {
        if (selectedIds.size === 0) {
            setAlert({ title: 'Atenção', message: 'Selecione pelo menos um boleto.', type: 'warning' });
            return;
        }
        setIsBulkModalOpen(true);
    };

    const handlePrintSelected = () => {
        const ids = Array.from(selectedIds).join(',');
        window.open(`/contratos/print/boletos?ids=${ids}`, '_blank');
        setIsBulkModalOpen(false);
    };

    const handleUpdateStatus = async (newStatus: string) => {
        setLoading(true);
        try {
            await api.post('/contratos/parcelas/bulk-update', {
                ids: Array.from(selectedIds),
                status: newStatus
            });
            await loadParcelas(); // Reload to see changes
            setAlert({ title: 'Sucesso', message: 'Status atualizado com sucesso!', type: 'success' });
        } catch (err: unknown) {
            setAlert({
                title: 'Erro',
                message: err instanceof Error ? err.message : 'Erro ao atualizar status',
                type: 'danger'
            });
        } finally {
            setLoading(false);
            setIsBulkModalOpen(false);
        }
    };

    const formatCurrency = (val: string | number) => {
        const num = Number(val) || 0;
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDate = (d: string) => {
        if (!d) return '-';
        // Handle ISO string or simple date string safely
        const datePart = d.split('T')[0];
        const [y, m, day] = datePart.split('-');
        return `${day}/${m}/${y}`;
    };

    const getStatusBadge = (p: Parcela) => {
        const isAtrasado = p.status_pagamento === 'pendente' && p.data_vencimento && new Date(p.data_vencimento.split('T')[0]) < new Date(new Date().setHours(0, 0, 0, 0));
        const status = isAtrasado ? 'atrasado' : p.status_pagamento;

        switch (status) {
            case 'pago': return <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-xs font-semibold"><CheckCircle className="w-3 h-3" /> Pago</span>;
            case 'atrasado': return <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded-full text-xs font-semibold"><AlertTriangle className="w-3 h-3" /> Atrasado</span>;
            case 'cancelado': return <span className="flex items-center gap-1 text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full text-xs font-medium"><Ban className="w-3 h-3" /> Cancelado</span>;
            default: return <span className="flex items-center gap-1 text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full text-xs font-semibold"><Clock className="w-3 h-3" /> Pendente</span>;
        }
    };

    const getTotal = (p: Parcela) => {
        return (Number(p.valor_base) || 0) + (Number(p.valor_iptu) || 0) + (Number(p.valor_agua) || 0) + (Number(p.valor_luz) || 0) + (Number(p.valor_outros) || 0) - (Number(p.desconto_pontualidade) || 0);
    };

    const totalPages = Math.ceil(parcelas.length / itemsPerPage);
    const paginatedParcelas = parcelas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const allVisibleSelected = paginatedParcelas.length > 0 && paginatedParcelas.every(p => selectedIds.has(p.id));

    return (
        <div className="space-y-6 pt-10 md:pt-0">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center md:text-left">
                    <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] flex items-center justify-center md:justify-start gap-2">
                        <FileText className="w-8 h-8 text-[var(--color-primary)]" /> Central de Boletos
                    </h1>
                    <p className="text-[var(--color-text-muted)] mt-1">Gere e imprima boletos em massa</p>
                </div>
                <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 w-full md:w-auto">
                    <button onClick={openNewParcela} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/25 min-w-[140px]">
                        <DollarSign className="w-5 h-5" /> <span className="inline">Nova Cobrança</span>
                    </button>
                    <button onClick={loadParcelas} disabled={loading} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-[var(--color-text)] font-semibold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> <span className="inline">Atualizar</span>
                    </button>
                    <button onClick={handleBulkActionClick} disabled={selectedIds.size === 0}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25 min-w-[140px]">
                        <CheckSquare className="w-5 h-5" /> Ações ({selectedIds.size})
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Data Início</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="date" value={dtInicio} onChange={e => setDtInicio(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20" />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Data Fim</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="date" value={dtFim} onChange={e => setDtFim(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20" />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Imóvel</label>
                    <Combobox
                        options={propriedades.map(p => ({ id: p.id, label: p.nome || p.endereco }))}
                        value={imovelId}
                        onChange={val => setImovelId(String(val))}
                        placeholder="Todos os Imóveis"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Inquilino</label>
                    <Combobox
                        options={inquilinos.map(i => ({ id: i.id, label: i.nome_completo }))}
                        value={inquilinoId}
                        onChange={val => setInquilinoId(String(val))}
                        placeholder="Todos"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--color-text-muted)]">Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20">
                        <option value="todos">Todos</option>
                        <option value="pendente">Pendente</option>
                        <option value="pago">Pago</option>
                        <option value="atrasado">Atrasado</option>
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[1000px]">
                        <thead className="bg-gray-50/80">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <button onClick={toggleAll} className="text-gray-500 hover:text-[var(--color-primary)]">
                                        {allVisibleSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Vencimento</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Inquilino</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Imóvel / Unidade</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Descrição</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Total</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Status</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                            {loading ? (
                                <tr><td colSpan={8} className="px-6 py-12 text-center text-[var(--color-text-muted)]">Carregando...</td></tr>
                            ) : parcelas.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-[var(--color-text-muted)]">Nenhum boleto encontrado para os filtros selecionados.</p>
                                    </td>
                                </tr>
                            ) : paginatedParcelas.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => toggleSelect(p.id)}>
                                    <td className="px-4 py-3">
                                        <div className={`transition-colors ${selectedIds.has(p.id) ? 'text-[var(--color-primary)]' : 'text-gray-300'}`}>
                                            {selectedIds.has(p.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium">{formatDate(p.data_vencimento)}</td>
                                    <td className="px-4 py-3 text-sm">{p.inquilino_nome || '—'}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <div className="font-medium text-xs text-gray-900">{p.imovel_nome || p.imovel_endereco}</div>
                                        <div className="text-xs text-gray-500">{p.unidade_identificador}</div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{p.descricao || `Parcela ${p.numero_parcela}`}</td>
                                    <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(getTotal(p))}</td>
                                    <td className="px-4 py-3">{getStatusBadge(p)}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openEditParcela(p); }}
                                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                                                title="Editar"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>

                                            {p.contrato_id && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openContractDetail(p.contrato_id!); }}
                                                    className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                                                    title="Ver Contrato"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </button>
                                            )}

                                            <a
                                                href={`/contratos/print/boletos?ids=${p.id}`}
                                                target="_blank"
                                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                                title="Imprimir"
                                            >
                                                <Printer className="w-4 h-4" />
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

            <BulkActionModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                onPrint={handlePrintSelected}
                onUpdateStatus={handleUpdateStatus}
                selectedCount={selectedIds.size}
            />

            <ParcelaModal
                isOpen={isParcelaModalOpen}
                onClose={() => setIsParcelaModalOpen(false)}
                onSave={loadParcelas}
                initialData={editingParcela}
                propriedades={propriedades}
                inquilinos={inquilinos}
            />

            <AlertModal
                isOpen={alert !== null}
                onClose={() => setAlert(null)}
                title={alert?.title || ''}
                message={alert?.message || ''}
                type={alert?.type}
            />

            <ContractDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                contractId={selectedContractId}
            />
        </div>
    );
}
