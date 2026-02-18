'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, Layers } from 'lucide-react';

interface InstallmentGenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (mode: 'next' | 'manual' | 'all', dataVencimento?: string, valor?: string) => void;
    contractValue: number;
}

export default function InstallmentGenerationModal({
    isOpen,
    onClose,
    onConfirm,
    contractValue
}: InstallmentGenerationModalProps) {
    const [visible, setVisible] = useState(false);
    const [mode, setMode] = useState<'next' | 'manual' | 'all'>('next');
    const [dataVencimento, setDataVencimento] = useState('');
    const [valor, setValor] = useState(contractValue.toString());

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
            setValor(contractValue.toString());
            setMode('next');
            setDataVencimento('');
        }
        else setTimeout(() => setVisible(false), 300);
    }, [isOpen, contractValue]);

    if (!visible && !isOpen) return null;

    const handleSubmit = () => {
        onConfirm(mode, dataVencimento, valor);
        onClose();
    };

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className={`
                relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all duration-200
                ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}
            `}>
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Gerar Parcelas</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            onClick={() => setMode('next')}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${mode === 'next' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                        >
                            <Calendar className="w-6 h-6" />
                            <span className="text-xs font-semibold">Próxima</span>
                        </button>
                        <button
                            onClick={() => setMode('manual')}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${mode === 'manual' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                        >
                            <DollarSign className="w-6 h-6" />
                            <span className="text-xs font-semibold">Avulsa</span>
                        </button>
                        <button
                            onClick={() => setMode('all')}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${mode === 'all' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                        >
                            <Layers className="w-6 h-6" />
                            <span className="text-xs font-semibold">Restantes</span>
                        </button>
                    </div>

                    <div className="space-y-4">
                        {mode === 'next' && (
                            <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                Gera a próxima parcela automaticamente seguindo a sequência do contrato.
                            </p>
                        )}

                        {mode === 'all' && (
                            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100">
                                Gera todas as parcelas restantes até o fim do contrato. Use com cuidado.
                            </p>
                        )}

                        {mode === 'manual' && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Data Vencimento</label>
                                    <input
                                        type="date"
                                        value={dataVencimento}
                                        onChange={e => setDataVencimento(e.target.value)}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Valor</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={valor}
                                        onChange={e => setValor(e.target.value)}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={mode === 'manual' && !dataVencimento}
                        className="px-6 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Gerar
                    </button>
                </div>
            </div>
        </div>
    );
}
