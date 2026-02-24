'use client';

import { useState, useEffect } from 'react';
import { X, DollarSign, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { Combobox } from '@/components/ui/Combobox';

interface ParcelaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    initialData?: any;
    propriedades: any[];
    inquilinos: any[];
}

export default function ParcelaModal({
    isOpen,
    onClose,
    onSave,
    initialData,
    propriedades,
    inquilinos
}: ParcelaModalProps) {
    const [form, setForm] = useState({
        id: '',
        unidade_id: '',
        inquilino_id: '',
        descricao: '',
        data_vencimento: '',
        valor_base: '',
        valor_iptu: '',
        valor_agua: '',
        valor_luz: '',
        valor_outros: '',
        observacoes: '',
        status_pagamento: 'pendente',
        desconto_pontualidade: '0'
    });

    const [unidades, setUnidades] = useState<any[]>([]);
    const [selectedPropId, setSelectedPropId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isEditing = !!initialData;

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Populate form
                setForm({
                    id: initialData.id,
                    unidade_id: initialData.unidade_id,
                    inquilino_id: initialData.inquilino_id,
                    descricao: initialData.descricao || '',
                    data_vencimento: initialData.data_vencimento ? initialData.data_vencimento.split('T')[0] : '',
                    valor_base: initialData.valor_base,
                    valor_iptu: initialData.valor_iptu,
                    valor_agua: initialData.valor_agua,
                    valor_luz: initialData.valor_luz,
                    valor_outros: initialData.valor_outros,
                    observacoes: initialData.observacoes || '',
                    status_pagamento: initialData.status_pagamento,
                    desconto_pontualidade: initialData.desconto_pontualidade || '0'
                });
                // If editing, we might need to fetch units for the unit's property... 
                // but unit selection is tricky in edit mode. 
                // Usually we don't move a financial record between units.
                // Let's disable unit/property changing in edit mode for safety.
                setSelectedPropId('');
            } else {
                // Reset
                setForm({
                    id: '',
                    unidade_id: '',
                    inquilino_id: '',
                    descricao: '',
                    data_vencimento: '',
                    valor_base: '',
                    valor_iptu: '',
                    valor_agua: '',
                    valor_luz: '',
                    valor_outros: '',
                    observacoes: '',
                    status_pagamento: 'pendente',
                    desconto_pontualidade: '0'
                });
                setSelectedPropId('');
                setUnidades([]);
            }
            setError('');
        }
    }, [isOpen, initialData]);

    const handleSelectProperty = async (propId: string) => {
        setSelectedPropId(propId);
        setForm(prev => ({ ...prev, unidade_id: '' }));
        if (!propId) {
            setUnidades([]);
            return;
        }
        try {
            const units = await api.get(`/propriedades/${propId}/unidades`);
            setUnidades(units);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const payload = {
                ...form,
                valor_base: parseFloat(form.valor_base) || 0,
                valor_iptu: parseFloat(form.valor_iptu) || 0,
                valor_agua: parseFloat(form.valor_agua) || 0,
                valor_luz: parseFloat(form.valor_luz) || 0,
                valor_outros: parseFloat(form.valor_outros) || 0,
                desconto_pontualidade: parseFloat(form.desconto_pontualidade) || 0,
            };

            if (isEditing) {
                await api.patch(`/contratos/parcelas/${form.id}`, payload);
            } else {
                await api.post('/contratos/parcelas/avulso', payload);
            }
            onSave();
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar');
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800">{isEditing ? 'Editar Parcela' : 'Nova Cobrança Avulsa'}</h2>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {!isEditing && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Imóvel *</label>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Unidade *</label>
                                    <Combobox
                                        options={unidades.map(u => ({
                                            id: u.id,
                                            label: `${u.identificador} (${u.tipo_unidade})`
                                        }))}
                                        value={form.unidade_id}
                                        onChange={val => setForm({ ...form, unidade_id: String(val) })}
                                        placeholder="Selecione a unidade"
                                        required
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição *</label>
                            <input type="text" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                                required placeholder="Ex: Multa, Conserto..." className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Inquilino (Opcional)</label>
                            <Combobox
                                options={inquilinos.map(i => ({ id: i.id, label: i.nome_completo }))}
                                value={form.inquilino_id || ''}
                                onChange={val => setForm({ ...form, inquilino_id: String(val) })}
                                placeholder="Selecione o inquilino"
                                disabled={isEditing}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Vencimento *</label>
                            <input type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })}
                                required className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status Pagamento</label>
                            <select value={form.status_pagamento} onChange={e => setForm({ ...form, status_pagamento: e.target.value })} className={inputClass}>
                                <option value="pendente">Pendente</option>
                                <option value="pago">Pago</option>
                                <option value="cancelado">Cancelado</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl space-y-4 border border-gray-200">
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            <DollarSign className="w-4 h-4" /> Valores
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Valor Base</label>
                                <input type="number" step="0.01" value={form.valor_base}
                                    onChange={e => setForm({ ...form, valor_base: e.target.value })} placeholder="0,00" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">IPTU</label>
                                <input type="number" step="0.01" value={form.valor_iptu}
                                    onChange={e => setForm({ ...form, valor_iptu: e.target.value })} placeholder="0,00" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Água</label>
                                <input type="number" step="0.01" value={form.valor_agua}
                                    onChange={e => setForm({ ...form, valor_agua: e.target.value })} placeholder="0,00" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Luz</label>
                                <input type="number" step="0.01" value={form.valor_luz}
                                    onChange={e => setForm({ ...form, valor_luz: e.target.value })} placeholder="0,00" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Outros</label>
                                <input type="number" step="0.01" value={form.valor_outros}
                                    onChange={e => setForm({ ...form, valor_outros: e.target.value })} placeholder="0,00" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-red-500 mb-1">Desc. Pontualidade</label>
                                <input type="number" step="0.01" value={form.desconto_pontualidade}
                                    onChange={e => setForm({ ...form, desconto_pontualidade: e.target.value })} placeholder="0,00" className={`${inputClass} border-red-100 bg-red-50/30`} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Observações</label>
                        <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}
                            rows={3} placeholder="Observações..." className={`${inputClass} resize-none`} />
                    </div>

                    {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="px-6 py-2 rounded-xl border border-gray-200 font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
                        <button type="submit" disabled={loading}
                            className="px-6 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20">
                            {loading ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Criar Cobrança')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
