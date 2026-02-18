'use client';

import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'danger' | 'success' | 'info' | 'warning';
    buttonText?: string;
}

export default function AlertModal({
    isOpen,
    onClose,
    title,
    message,
    type = 'info',
    buttonText = 'OK'
}: AlertModalProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isOpen) setVisible(true);
        else setTimeout(() => setVisible(false), 300);
    }, [isOpen]);

    if (!visible && !isOpen) return null;

    const colors = {
        danger: { bg: 'bg-red-100', text: 'text-red-600', button: 'bg-red-600 hover:bg-red-700', icon: AlertTriangle },
        success: { bg: 'bg-green-100', text: 'text-green-600', button: 'bg-green-600 hover:bg-green-700', icon: CheckCircle },
        warning: { bg: 'bg-amber-100', text: 'text-amber-600', button: 'bg-amber-600 hover:bg-amber-700', icon: AlertTriangle },
        info: { bg: 'bg-blue-100', text: 'text-blue-600', button: 'bg-blue-600 hover:bg-blue-700', icon: Info },
    };

    const Config = colors[type];
    const Icon = Config.icon;

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className={`
                relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all duration-200
                ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}
            `}>
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-full ${Config.bg} flex items-center justify-center shrink-0`}>
                            <Icon className={`w-6 h-6 ${Config.text}`} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">{message}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 px-6 py-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className={`px-6 py-2 rounded-xl text-sm font-semibold text-white shadow-lg shadow-black/5 transition-all w-full sm:w-auto ${Config.button}`}
                    >
                        {buttonText}
                    </button>
                </div>
            </div>
        </div>
    );
}
