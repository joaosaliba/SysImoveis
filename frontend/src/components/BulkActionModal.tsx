'use client';

import { useState, useEffect } from 'react';
import { X, Printer, RefreshCw, CheckCircle, AlertTriangle, Clock, Ban } from 'lucide-react';

interface BulkActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPrint: () => void;
    onUpdateStatus: (status: string) => void;
    selectedCount: number;
}

export default function BulkActionModal({
    isOpen,
    onClose,
    onPrint,
    onUpdateStatus,
    selectedCount
}: BulkActionModalProps) {
    const [visible, setVisible] = useState(false);
    const [action, setAction] = useState<'print' | 'status'>('status');
    const [selectedStatus, setSelectedStatus] = useState('pago');

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
            setAction('status');
        }
        else setTimeout(() => setVisible(false), 300);
    }, [isOpen]);

    if (!visible && !isOpen) return null;

    const handleConfirm = () => {
        if (action === 'print') {
            onPrint();
        } else {
            onUpdateStatus(selectedStatus);
        }
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
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Ações em Massa</h3>
                        <p className="text-sm text-gray-500">{selectedCount} itens selecionados</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setAction('status')}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${action === 'status' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                        >
                            <RefreshCw className="w-6 h-6" />
                            <span className="text-sm font-semibold">Alterar Status</span>
                        </button>
                        <button
                            onClick={() => setAction('print')}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${action === 'print' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                        >
                            <Printer className="w-6 h-6" />
                            <span className="text-sm font-semibold">Imprimir</span>
                        </button>
                    </div>

                    <div className="space-y-4">
                        {action === 'status' && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Novo Status</label>
                                <div className="space-y-2">
                                    {[
                                        { value: 'pago', label: 'Pago', icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-200' },
                                        { value: 'pendente', label: 'Pendente', icon: Clock, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
                                        { value: 'atrasado', label: 'Atrasado', icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-200' },
                                        { value: 'cancelado', label: 'Cancelado', icon: Ban, color: 'text-gray-600 bg-gray-100 border-gray-200' },
                                    ].map((opt) => (
                                        <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedStatus === opt.value ? `ring-2 ring-blue-500 ring-offset-1 ${opt.color}` : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                                            <input
                                                type="radio"
                                                name="status"
                                                value={opt.value}
                                                checked={selectedStatus === opt.value}
                                                onChange={(e) => setSelectedStatus(e.target.value)}
                                                className="hidden"
                                            />
                                            <opt.icon className="w-5 h-5 shrink-0" />
                                            <span className="font-medium">{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {action === 'print' && (
                            <p className="text-sm text-gray-500 bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                                <Printer className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                <span>
                                    Será gerado um arquivo de impressão contendo <b>{selectedCount} boletos</b>.
                                    Certifique-se de que a impressora está configurada para papel A4.
                                </span>
                            </p>
                        )}
                    </div>
                </div>

                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-6 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all"
                    >
                        {action === 'print' ? 'Imprimir' : 'Atualizar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
