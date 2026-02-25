'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/RequireRole';
import { Pagination } from '@/components/ui/Pagination';
import { Search, History, Filter, X, ShieldCheck, FileText } from 'lucide-react';

interface Auditoria {
    id: string;
    usuario_id: string | null;
    usuario_nome: string | null;
    usuario_email: string | null;
    acao: string;
    entidade: string;
    entidade_id: string | null;
    dados_antigos: any;
    dados_novos: any;
    detalhes: string | null;
    ip: string | null;
    created_at: string;
}

interface FiltrosOptions {
    usuarios: { id: string; nome: string }[];
    acoes: string[];
    entidades: string[];
}

interface PaginatedResponse {
    data: Auditoria[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export default function AuditoriaPage() {
    const { isAdmin } = useAuth();
    const [paginationData, setPaginationData] = useState<PaginatedResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [filtrosOptions, setFiltrosOptions] = useState<FiltrosOptions>({
        usuarios: [],
        acoes: [],
        entidades: []
    });

    const [filtros, setFiltros] = useState({
        usuario_id: '',
        acao: '',
        entidade: '',
        data_inicio: '',
        data_fim: ''
    });

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [showFilters, setShowFilters] = useState(false);
    const [selectedAudit, setSelectedAudit] = useState<Auditoria | null>(null);

    // Load filter options
    useEffect(() => {
        if (!isAdmin) return;
        api.get('/auditoria/filtros').then(res => {
            setFiltrosOptions(res);
        }).catch(console.error);
    }, [isAdmin]);

    const loadData = useCallback(async () => {
        if (!isAdmin) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', currentPage.toString());
            params.set('limit', itemsPerPage.toString());

            if (filtros.usuario_id) params.set('usuario_id', filtros.usuario_id);
            if (filtros.acao) params.set('acao', filtros.acao);
            if (filtros.entidade) params.set('entidade', filtros.entidade);
            if (filtros.data_inicio) params.set('data_inicio', filtros.data_inicio);
            if (filtros.data_fim) params.set('data_fim', filtros.data_fim);

            const response = await api.get(`/auditoria?${params.toString()}`);
            setPaginationData(response);
        } catch (err) {
            console.error(err);
            setError('Erro ao carregar dados de auditoria');
        } finally {
            setLoading(false);
        }
    }, [filtros, currentPage, itemsPerPage, isAdmin]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const auditorias = paginationData?.data || [];
    const pagination = paginationData?.pagination;

    const handleFilterChange = (key: string, value: string) => {
        setFiltros(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1); // Reset to first page on filter
    };

    const clearFilters = () => {
        setFiltros({
            usuario_id: '',
            acao: '',
            entidade: '',
            data_inicio: '',
            data_fim: ''
        });
        setCurrentPage(1);
    };

    const formatDataHora = (iso: string) => {
        return new Date(iso).toLocaleString('pt-BR');
    };

    const getAcaoColor = (acao: string) => {
        switch (acao.toUpperCase()) {
            case 'CRIAR': return 'bg-green-100 text-green-700';
            case 'ATUALIZAR': return 'bg-blue-100 text-blue-700';
            case 'EXCLUIR': return 'bg-red-100 text-red-700';
            case 'LOGIN': return 'bg-purple-100 text-purple-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    // Redirect if not admin
    if (isAdmin === false) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <ShieldCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-[var(--color-text)]">Acesso Negado</h2>
                    <p className="text-[var(--color-text-muted)] mt-2">Apenas administradores podem visualizar a auditoria.</p>
                </div>
            </div>
        );
    }

    const inputClass = "w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]";

    return (
        <div className="space-y-6 pt-10 md:pt-0 pb-12">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text)]">Auditoria</h1>
                    <p className="text-[var(--color-text-muted)] mt-1">Acompanhamento das atividades do sistema</p>
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl border transition-all font-medium
                        ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-[var(--color-border)] hover:bg-gray-50'}`}
                >
                    <Filter className="w-5 h-5" /> Filtros
                </button>
            </div>

            {/* Filter Section */}
            {showFilters && (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--color-border)] animate-in slide-in-from-top-4 fade-in duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Usuário</label>
                            <select
                                value={filtros.usuario_id}
                                onChange={(e) => handleFilterChange('usuario_id', e.target.value)}
                                className={inputClass}
                            >
                                <option value="">Todos</option>
                                {filtrosOptions.usuarios.map(u => (
                                    <option key={u.id} value={u.id}>{u.nome}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Ação</label>
                            <select
                                value={filtros.acao}
                                onChange={(e) => handleFilterChange('acao', e.target.value)}
                                className={inputClass}
                            >
                                <option value="">Todas</option>
                                {filtrosOptions.acoes.map(a => (
                                    <option key={a} value={a}>{a}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Entidade</label>
                            <select
                                value={filtros.entidade}
                                onChange={(e) => handleFilterChange('entidade', e.target.value)}
                                className={inputClass}
                            >
                                <option value="">Todas</option>
                                {filtrosOptions.entidades.map(e => (
                                    <option key={e} value={e}>{e}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Data Inicial</label>
                            <input
                                type="date"
                                value={filtros.data_inicio}
                                onChange={(e) => handleFilterChange('data_inicio', e.target.value)}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Data Final</label>
                            <input
                                type="date"
                                value={filtros.data_fim}
                                onChange={(e) => handleFilterChange('data_fim', e.target.value)}
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={clearFilters}
                            className="text-sm font-medium text-red-600 hover:text-red-700 px-4 py-2"
                        >
                            Limpar Filtros
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/80">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Data / Hora</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Usuário</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Ação</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Entidade</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">IP</th>
                                <th className="px-6 py-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider text-center">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)] text-sm">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-[var(--color-text-muted)]">Carregando...</td></tr>
                            ) : auditorias.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-[var(--color-text-muted)]">Nenhum registro encontrado para os filtros atuais</p>
                                    </td>
                                </tr>
                            ) : (
                                auditorias.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                            {formatDataHora(item.created_at)}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-800">
                                            {item.usuario_nome || 'Sistema / Anonimo'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAcaoColor(item.acao)}`}>
                                                {item.acao}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {item.entidade}
                                            {item.entidade_id && <span className="block text-xs text-gray-400 truncate max-w-[120px]" title={item.entidade_id}>{item.entidade_id}</span>}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-gray-500 font-mono">
                                            {item.ip}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => setSelectedAudit(item)}
                                                className="p-2 inline-flex items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                                                title="Ver Detalhes"
                                            >
                                                <FileText className="w-4 h-4" />
                                            </button>
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

            {/* Modal for Details */}
            {selectedAudit && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--color-bg)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)] shrink-0">
                            <div>
                                <h2 className="text-xl font-bold">Detalhes da Auditoria</h2>
                                <p className="text-sm text-[var(--color-text-muted)] mt-1">{formatDataHora(selectedAudit.created_at)}</p>
                            </div>
                            <button onClick={() => setSelectedAudit(null)} className="p-2 rounded-lg hover:bg-black/5 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4 text-sm flex-1">
                            <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-[var(--color-border)]">
                                <div>
                                    <span className="block text-xs text-[var(--color-text-muted)] uppercase mb-1">Usuário</span>
                                    <span className="font-medium">{selectedAudit.usuario_nome || 'N/A'}</span>
                                    {selectedAudit.usuario_email && <span className="block text-xs text-gray-500">{selectedAudit.usuario_email}</span>}
                                </div>
                                <div>
                                    <span className="block text-xs text-[var(--color-text-muted)] uppercase mb-1">IP Origem</span>
                                    <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">{selectedAudit.ip || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-[var(--color-text-muted)] uppercase mb-1">Ação</span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getAcaoColor(selectedAudit.acao)}`}>
                                        {selectedAudit.acao}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs text-[var(--color-text-muted)] uppercase mb-1">Entidade</span>
                                    <span className="font-medium bg-gray-100 px-2 py-1 rounded text-xs">{selectedAudit.entidade}</span>
                                    {selectedAudit.entidade_id && <span className="block text-xs mt-1 text-gray-500 truncate" title={selectedAudit.entidade_id}>ID: {selectedAudit.entidade_id}</span>}
                                </div>
                            </div>

                            {selectedAudit.detalhes && (
                                <div>
                                    <h3 className="font-semibold text-[var(--color-text-muted)] mb-2 uppercase text-xs tracking-wider">Descrição</h3>
                                    <div className="bg-white p-3 rounded-xl border border-[var(--color-border)] text-gray-700">
                                        {selectedAudit.detalhes}
                                    </div>
                                </div>
                            )}

                            {selectedAudit.dados_novos && (
                                <div>
                                    <h3 className="font-semibold text-[var(--color-text-muted)] mb-2 uppercase text-xs tracking-wider">Dados (Novo Estado)</h3>
                                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto text-xs font-mono leading-relaxed">
                                        {JSON.stringify(selectedAudit.dados_novos, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {selectedAudit.dados_antigos && (
                                <div>
                                    <h3 className="font-semibold text-[var(--color-text-muted)] mb-2 uppercase text-xs tracking-wider">Dados (Estado Antigo)</h3>
                                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto text-xs font-mono leading-relaxed">
                                        {JSON.stringify(selectedAudit.dados_antigos, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-[var(--color-border)] shrink-0 flex justify-end bg-gray-50/50 rounded-b-2xl">
                            <button onClick={() => setSelectedAudit(null)} className="px-6 py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 font-medium rounded-xl transition-colors">
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
