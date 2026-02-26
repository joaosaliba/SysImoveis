'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { maskCPF, maskPhone, maskRG } from '@/lib/masks';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Search, Pencil, Trash2, X, Users, AlertTriangle, Upload, FileText, Download, File } from 'lucide-react';

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

interface Documento {
    id: string;
    nome_original: string;
    nome_arquivo: string;
    tipo: string;
    mimetype: string;
    tamanho_bytes: number;
    created_at: string;
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

const TIPOS_DOC = [
    { value: 'rg', label: 'RG' },
    { value: 'cpf', label: 'CPF' },
    { value: 'comprovante', label: 'Comprovante de Residência' },
    { value: 'contrato', label: 'Contrato de Trabalho' },
    { value: 'renda', label: 'Comprovante de Renda' },
    { value: 'outro', label: 'Outro' },
];

const emptyForm = {
    cpf: '', nome_completo: '', rg: '', orgao_emissor: '', uf_rg: '',
    telefone1: '', telefone2: '', email: '', observacoes: '', restricoes: '',
};

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function InquilinosPage() {
    const [paginationData, setPaginationData] = useState<PaginatedResponse | null>(null);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Inquilino | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Document state
    const [documentos, setDocumentos] = useState<Documento[]>([]);
    const [uploading, setUploading] = useState(false);
    const [tipoDoc, setTipoDoc] = useState('outro');
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const loadDocumentos = async (inquilinoId: string) => {
        try {
            const docs = await api.get(`/inquilinos/${inquilinoId}/documentos`);
            setDocumentos(docs);
        } catch { setDocumentos([]); }
    };

    const openNew = () => { setForm(emptyForm); setEditing(null); setDocumentos([]); setShowForm(true); setError(''); };

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
        loadDocumentos(t.id);
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

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0 || !editing) return;
        setUploading(true);
        try {
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('arquivos', files[i]);
            }
            formData.append('tipo', tipoDoc);
            await api.upload(`/inquilinos/${editing.id}/documentos`, formData);
            loadDocumentos(editing.id);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Erro no upload');
        } finally { setUploading(false); }
    };

    const handleDeleteDoc = async (docId: string) => {
        if (!confirm('Remover este documento?')) return;
        try {
            await api.delete(`/inquilinos/documentos/${docId}`);
            if (editing) loadDocumentos(editing.id);
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Erro ao remover');
        }
    };

    const handleDownload = (docId: string) => {
        const url = api.downloadUrl(`/inquilinos/documentos/${docId}/download`);
        window.open(url, '_blank');
    };

    const inputClass = "w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]";

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

            {/* ===== TABELA DESKTOP ===== */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[1000px]">
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

            {/* ===== CARDS MOBILE ===== */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-6 text-center text-[var(--color-text-muted)]">
                        Carregando...
                    </div>
                ) : inquilinos.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-10 text-center">
                        <Users className="w-14 h-14 text-gray-300 mx-auto mb-3" />
                        <p className="text-[var(--color-text-muted)] text-lg">Nenhum inquilino encontrado</p>
                    </div>
                ) : inquilinos.map(t => (
                    <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="text-lg font-bold text-[var(--color-text)] leading-snug">{t.nome_completo}</p>
                                <p className="text-base text-[var(--color-text-muted)] font-mono mt-1">{t.cpf}</p>
                                {Array.isArray(t.telefones) && t.telefones.length > 0 && (
                                    <p className="text-base text-[var(--color-text-muted)] mt-1">{t.telefones[0]}</p>
                                )}
                                {t.restricoes && (
                                    <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700">
                                        <AlertTriangle className="w-4 h-4" /> Restrição
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                    onClick={() => openEdit(t)}
                                    className="p-3 rounded-xl bg-blue-50 text-[var(--color-primary)] hover:bg-blue-100 transition-colors"
                                >
                                    <Pencil className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handleDelete(t.id)}
                                    className="p-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
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
                                        required placeholder="Nome completo" className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">CPF *</label>
                                    <input type="text" value={form.cpf} onChange={e => setForm({ ...form, cpf: maskCPF(e.target.value) })}
                                        required placeholder="000.000.000-00" maxLength={14} className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Email</label>
                                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                                        placeholder="email@exemplo.com" className={inputClass} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">RG</label>
                                    <input type="text" value={form.rg} onChange={e => setForm({ ...form, rg: maskRG(e.target.value) })}
                                        placeholder="00.000.000-0" maxLength={12} className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Órgão Emissor</label>
                                    <input type="text" value={form.orgao_emissor} onChange={e => setForm({ ...form, orgao_emissor: e.target.value })}
                                        placeholder="SSP" className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">UF do RG</label>
                                    <select value={form.uf_rg} onChange={e => setForm({ ...form, uf_rg: e.target.value })} className={inputClass}>
                                        <option value="">Selecione</option>
                                        {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Telefone 1</label>
                                    <input type="text" value={form.telefone1} onChange={e => setForm({ ...form, telefone1: maskPhone(e.target.value) })}
                                        placeholder="(00) 00000-0000" maxLength={15} className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Telefone 2</label>
                                    <input type="text" value={form.telefone2} onChange={e => setForm({ ...form, telefone2: maskPhone(e.target.value) })}
                                        placeholder="(00) 00000-0000" maxLength={15} className={inputClass} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Observações</label>
                                <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}
                                    rows={2} placeholder="Observações..."
                                    className={`${inputClass} resize-none`} />
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

                        {/* ===== DOCUMENTOS SECTION (editing only) ===== */}
                        {editing && (
                            <div className="p-6 border-t border-[var(--color-border)]">
                                <h3 className="text-lg font-bold text-[var(--color-text)] mb-4 flex items-center gap-2">
                                    <FileText className="w-5 h-5" /> Documentos
                                </h3>

                                {/* Upload area */}
                                <div className="mb-4 p-4 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-gray-50/50">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                        <select value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}
                                            className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm">
                                            {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            multiple
                                            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                                            onChange={e => handleUpload(e.target.files)}
                                            className="hidden"
                                            id="doc-upload"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium
                                                hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
                                        >
                                            <Upload className="w-4 h-4" />
                                            {uploading ? 'Enviando...' : 'Selecionar Arquivos'}
                                        </button>
                                        <span className="text-xs text-[var(--color-text-muted)]">
                                            PDF, imagens ou Word • Máx. 10MB cada • Até 5 arquivos
                                        </span>
                                    </div>
                                </div>

                                {/* Document list */}
                                {documentos.length === 0 ? (
                                    <div className="text-center py-6 text-[var(--color-text-muted)]">
                                        <File className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                        <p className="text-sm">Nenhum documento enviado</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {documentos.map(doc => (
                                            <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-[var(--color-border)]">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-[var(--color-text)] truncate">{doc.nome_original}</p>
                                                        <p className="text-xs text-[var(--color-text-muted)]">
                                                            {TIPOS_DOC.find(t => t.value === doc.tipo)?.label || doc.tipo} • {formatFileSize(doc.tamanho_bytes)} • {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    <button onClick={() => handleDownload(doc.id)}
                                                        className="p-2 rounded-lg hover:bg-blue-50 text-[var(--color-primary)]" title="Baixar">
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteDoc(doc.id)}
                                                        className="p-2 rounded-lg hover:bg-red-50 text-red-500" title="Remover">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
