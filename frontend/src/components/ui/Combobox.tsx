'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface Option {
    id: string | number;
    label: string;
}

interface ComboboxProps {
    options: Option[];
    value: string | number;
    onChange: (value: string | number) => void;
    placeholder?: string;
    emptyMessage?: string;
    className?: string;
    disabled?: boolean;
    required?: boolean;
}

export function Combobox({
    options,
    value,
    onChange,
    placeholder = 'Pesquisar...',
    emptyMessage = 'Nenhum resultado encontrado.',
    className = '',
    disabled = false,
    required = false
}: ComboboxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = useMemo(() =>
        options.find(opt => String(opt.id) === String(value)),
        [options, value]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        const term = searchTerm.toLowerCase();
        return options.filter(opt => opt.label.toLowerCase().includes(term));
    }, [options, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync search term with selected option when not focused
    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    const handleSelect = (id: string | number) => {
        onChange(id);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearchTerm('');
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] transition-all
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text hover:border-[var(--color-primary)]'}
                    ${isOpen ? 'ring-2 ring-[var(--color-primary)]/30 border-[var(--color-primary)]' : ''}`}
                onClick={() => !disabled && setIsOpen(true)}
            >
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                    type="text"
                    className="flex-1 bg-transparent border-none outline-none text-sm p-0 placeholder:text-gray-400"
                    placeholder={selectedOption ? selectedOption.label : placeholder}
                    value={isOpen ? searchTerm : (selectedOption ? selectedOption.label : '')}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => !disabled && setIsOpen(true)}
                    disabled={disabled}
                    required={required && !value}
                />
                <div className="flex items-center gap-1 shrink-0">
                    {value && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-[100] w-full mt-1 bg-white rounded-xl shadow-xl border border-[var(--color-border)] py-1 max-h-60 overflow-y-auto anima-in slide-in-from-top-2 duration-200">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                                    ${String(value) === String(opt.id)
                                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold'
                                        : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                onClick={() => handleSelect(opt.id)}
                            >
                                {opt.label}
                            </button>
                        ))
                    ) : (
                        <div className="px-4 py-3 text-sm text-gray-500 italic">
                            {emptyMessage}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
