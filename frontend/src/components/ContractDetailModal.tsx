'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { X, Printer, FileText, AlertTriangle, CheckCircle, Clock, Ban, DollarSign, CalendarPlus, RefreshCw, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';

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
    renovacoes?: any[];
}

interface ContractDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    contractId: string | null;
}

export default function ContractDetailModal({ isOpen, onClose, contractId }: ContractDetailModalProps) {
    const [contract, setContract] = useState<Contrato | null>(null);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const itemsPerPage = 12;

    const fetchContract = useCallback(async () => {
        if (!contractId) return;
        setLoading(true);
        try {
            const data = await api.get(`/contratos/${contractId}`);
            setContract(data);
            setPage(1);
        } catch (err) {
            console.error('Error fetching contract details:', err);
        } finally {
            setLoading(false);
        }
    }, [contractId]);

    useEffect(() => {
        if (isOpen && contractId) {
            fetchContract();
        } else if (!isOpen) {
            setContract(null);
        }
    }, [isOpen, contractId, fetchContract]);

    const formatCurrency = (val: any) => {
        return (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDate = (d: string) => {
        if (!d) return '-';
        const [y, m, day] = d.split('T')[0].split('-');
        return `${day}/${m}/${y}`;
    };

    const getParcelaTotal = (p: Parcela) => {
        return Number(p.valor_base) + Number(p.valor_iptu || 0) + Number(p.valor_agua || 0) + Number(p.valor_luz || 0) + Number(p.valor_outros || 0);
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
        switch (status) {
            case 'pago': return 'Pago';
            case 'atrasado': return 'Atrasado';
            case 'cancelado': return 'Cancelado';
            default: return 'Pendente';
        }
    };

    if (!isOpen) return null;

    const allParcelas = contract?.parcelas || [];
    const totalPages = Math.ceil(allParcelas.length / itemsPerPage);
    const paginatedParcelas = allParcelas.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    return (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)] shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--color-text)]">Detalhes do Contrato</h2>
                        {contract && (
                            <p className="text-sm text-[var(--color-text-muted)]">
                                {contract.inquilino_nome} — {contract.unidade_identificador} ({contract.imovel_endereco})
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <RefreshCw className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
                            <p className="text-[var(--color-text-muted)] font-medium">Carregando informações...</p>
                        </div>
                    ) : contract ? (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 transition-colors">
                                    <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Inquilino</p>
                                    <p className="text-sm font-semibold mt-2">{contract.inquilino_nome}</p>
                                    <p className="text-xs text-[var(--color-text-muted)]">{contract.inquilino_cpf}</p>
                                    {contract.inquilino_restricoes && (
                                        <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">
                                            <AlertTriangle className="w-3 h-3" /> Restrição
                                        </span>
                                    )}
                                </div>
                                <div className="p-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 transition-colors">
                                    <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Unidade</p>
                                    <p className="text-sm font-semibold mt-2">{contract.unidade_identificador} ({contract.tipo_unidade})</p>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                        {contract.imovel_endereco}{contract.imovel_numero ? `, ${contract.imovel_numero}` : ''}
                                    </p>
                                    <p className="text-[10px] text-[var(--color-text-muted)] uppercase mt-0.5 font-medium">{contract.imovel_cidade}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 transition-colors">
                                    <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Valor / Vencimento</p>
                                    <p className="text-lg font-bold text-[var(--color-primary)] mt-1">{formatCurrency(contract.valor_inicial)}</p>
                                    <p className="text-xs text-[var(--color-text-muted)] font-medium">
                                        Dia {contract.dia_vencimento} • {formatDate(contract.data_inicio)} a {formatDate(contract.data_fim)}
                                    </p>
                                </div>
                            </div>

                            {/* History Section (Renewals) */}
                            {contract.renovacoes && contract.renovacoes.length > 0 && (
                                <section>
                                    <h3 className="text-lg font-bold text-[var(--color-text)] mb-4 flex items-center gap-2">
                                        <RefreshCw className="w-5 h-5 text-purple-500" /> Histórico de Renovações
                                    </h3>
                                    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] shadow-sm">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50/80">
                                                <tr>
                                                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted2)]">Data</th>
                                                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted2)]">Vlr. Anterior</th>
                                                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted2)]">Novo Valor</th>
                                                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted2)]">Novo Fim</th>
                                                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted2)]">Índice</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[var(--color-border)]">
                                                {contract.renovacoes.map((r: any) => (
                                                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-4 py-3">{formatDate(r.data_renovacao)}</td>
                                                        <td className="px-4 py-3 text-gray-500">{formatCurrency(r.valor_anterior)}</td>
                                                        <td className="px-4 py-3 font-bold text-green-600">{formatCurrency(r.valor_novo)}</td>
                                                        <td className="px-4 py-3">{formatDate(r.data_fim_novo)}</td>
                                                        <td className="px-4 py-3 font-medium">{r.indice_reajuste || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            )}

                            {/* Parcelas Section */}
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-blue-500" /> Parcelas e Cobranças
                                    </h3>
                                    <span className="px-3 py-1 bg-gray-100 text-[var(--color-text-muted)] rounded-full text-xs font-bold">
                                        Total: {allParcelas.length}
                                    </span>
                                </div>

                                <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] shadow-sm">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50/80">
                                            <tr>
                                                <th className="px-4 py-3 font-bold text-[var(--color-text-muted2)] w-10">#</th>
                                                <th className="px-4 py-3 font-bold text-[var(--color-text-muted2)]">Vencimento</th>
                                                <th className="px-4 py-3 font-bold text-[var(--color-text-muted2)] text-right">Valor</th>
                                                <th className="px-4 py-3 font-bold text-[var(--color-text-muted2)]">Status</th>
                                                <th className="px-4 py-3 font-bold text-[var(--color-text-muted2)]">Pagamento</th>
                                                <th className="px-4 py-3 font-bold text-[var(--color-text-muted2)] text-right">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--color-border)]">
                                            {paginatedParcelas.length > 0 ? (
                                                paginatedParcelas.map(p => (
                                                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-4 py-3 font-bold text-gray-400">{p.numero_parcela}</td>
                                                        <td className="px-4 py-3 font-medium">{formatDate(p.data_vencimento)}</td>
                                                        <td className="px-4 py-3 font-bold text-right">{formatCurrency(getParcelaTotal(p))}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-1.5">
                                                                {parcelaStatusIcon(p.status_pagamento)}
                                                                <span className="text-xs font-bold uppercase tracking-tight">{parcelaStatusLabel(p.status_pagamento)}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs">
                                                            {p.data_pagamento ? (
                                                                <div>
                                                                    <div className="font-semibold">{formatDate(p.data_pagamento)}</div>
                                                                    <div className="text-green-600 font-bold">{formatCurrency(p.valor_pago)}</div>
                                                                </div>
                                                            ) : '—'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <a href={`/contratos/print/boleto/${p.id}`} target="_blank"
                                                                className="inline-flex items-center justify-center p-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-all border border-transparent hover:border-blue-100" title="Imprimir Boleto">
                                                                <Printer className="w-4 h-4" />
                                                            </a>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400 italic font-medium">
                                                        Nenhuma parcela encontrada para este contrato.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-4">
                                    <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                                </div>
                            </section>

                            {/* Observations */}
                            {contract.observacoes_contrato && (
                                <section className="p-4 rounded-xl bg-yellow-50/50 border border-yellow-100">
                                    <h3 className="text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" /> Observações do Contrato
                                    </h3>
                                    <p className="text-sm text-yellow-700 leading-relaxed whitespace-pre-wrap">
                                        {contract.observacoes_contrato}
                                    </p>
                                </section>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-20 text-[var(--color-text-muted)] font-medium">
                            <Ban className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            Contrato não encontrado.
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[var(--color-border)] bg-gray-50/50 rounded-b-2xl flex justify-between items-center shrink-0">
                    <div className="flex gap-2">
                        {contract && (
                            <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[var(--color-border)] text-[var(--color-text)] font-semibold hover:bg-gray-50 transition-all shadow-sm">
                                <Printer className="w-4 h-4" /> Imprimir Ficha
                            </button>
                        )}
                    </div>
                    <button onClick={onClose} className="px-8 py-2.5 rounded-xl bg-white border border-[var(--color-border)] font-bold text-[var(--color-text)] hover:bg-gray-50 transition-all shadow-sm">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
