'use client';

import { useEffect, useState, Suspense } from 'react';
import { api } from '@/lib/api';
import { useSearchParams } from 'next/navigation';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface BoletoData {
    id: string;
    inquilino_nome: string;
    inquilino_cpf: string;
    imovel_endereco: string;
    imovel_numero: string;
    imovel_cidade: string;
    imovel_nome: string;
    unidade_identificador: string;
    tipo_unidade: string;
    valor_base: string;
    valor_iptu: string;
    valor_agua: string;
    valor_luz: string;
    valor_outros: string;
    desconto_pontualidade: string;
    data_vencimento: string;
    descricao?: string;
    numero_parcela: number;
}

function BulkBoletoPrintContent() {
    const searchParams = useSearchParams();
    const idsString = searchParams.get('ids');
    const [boletos, setBoletos] = useState<BoletoData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!idsString) {
            setLoading(false);
            return;
        }

        const ids = idsString.split(',').filter(id => id && id !== 'undefined' && id !== 'null');

        if (ids.length === 0) {
            setLoading(false);
            return;
        }

        // Fetch all in parallel
        Promise.all(ids.map(id => api.get(`/contratos/parcelas/${id}`)))
            .then(data => {
                setBoletos(data);
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [idsString]);

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    if (boletos.length === 0) return <div className="p-8">Nenhum boleto selecionado.</div>;

    const formatCurrency = (val: string | number) => {
        const num = Number(val) || 0;
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        const [y, m, day] = d.split('-');
        return `${day}/${m}/${y}`;
    };

    const handlePrintPDF = () => {
        const token = localStorage.getItem('accessToken');
        window.location.href = `/api/contratos/parcelas/bulk/pdf?ids=${idsString}${token ? `&token=${token}` : ''}`;
    };

    // Helper to chunk array
    const chunk = <T,>(arr: T[], size: number): T[][] =>
        Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

    const boletoGroups = chunk(boletos, 4);

    return (
        <div className="bg-gray-100 min-h-screen text-black font-sans pb-10">
            {/* Toolbar - Fixed at top for preview mode */}
            <div className="sticky top-0 z-50 bg-white border-b border-gray-200 p-4 flex items-center justify-between shadow-sm print:hidden">
                <div className="flex items-center gap-4">
                    <Link href="/boletos" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="font-bold text-lg">Conferência de Boletos</h1>
                        <p className="text-xs text-gray-500">{boletos.length} boletos selecionados</p>
                    </div>
                </div>
                <button
                    onClick={handlePrintPDF}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95"
                >
                    <Printer className="w-5 h-5" /> Imprimir em PDF
                </button>
            </div>

            <div className="max-w-[210mm] mx-auto py-8 space-y-8">
                {boletoGroups.map((group, i) => (
                    <div key={i} className="bg-white shadow-xl ring-1 ring-gray-900/5">
                        {group.map((parcela) => {
                            const totalBruto = (
                                Number(parcela.valor_base) +
                                Number(parcela.valor_iptu) +
                                Number(parcela.valor_agua) +
                                Number(parcela.valor_luz) +
                                Number(parcela.valor_outros)
                            );
                            const desconto = Number(parcela.desconto_pontualidade) || 0;
                            const totalComDesconto = totalBruto - desconto;

                            return (
                                <div key={parcela.id} className="h-[73mm] border-b border-dashed border-gray-300 flex flex-col p-6 box-border relative">
                                    <div className="border border-black h-full flex flex-col text-xs">
                                        {/* Header Row */}
                                        <div className="border-b border-black flex bg-gray-50">
                                            <div className="flex-1 p-2 border-r border-black">
                                                <span className="font-bold text-[9px] block text-gray-400">SACADO</span>
                                                <div className="uppercase font-bold truncate text-[11px]">{parcela.inquilino_nome}</div>
                                            </div>
                                            <div className="w-1/4 p-2">
                                                <span className="font-bold text-[9px] block text-gray-400">CPF</span>
                                                <div className="font-semibold text-[11px]">{parcela.inquilino_cpf || '-'}</div>
                                            </div>
                                        </div>

                                        {/* Address Row */}
                                        <div className="border-b border-black flex">
                                            <div className="flex-[2] p-2 border-r border-black">
                                                <span className="font-bold text-[9px] block text-gray-400">ENDEREÇO</span>
                                                <div className="truncate text-[10px]">
                                                    {parcela.imovel_endereco}, {parcela.imovel_numero || ''} - {parcela.imovel_cidade}
                                                </div>
                                            </div>
                                            <div className="flex-1 p-2">
                                                <span className="font-bold text-[9px] block text-gray-400">UNIDADE</span>
                                                <div className="font-semibold text-[10px]">{parcela.tipo_unidade} {parcela.unidade_identificador}</div>
                                            </div>
                                        </div>

                                        {/* Values Area */}
                                        <div className="flex flex-1">
                                            <div className="w-1/2 border-r border-black flex flex-col">
                                                <div className="flex border-b border-black/30 p-1.5 justify-between italic">
                                                    <span>Aluguel</span>
                                                    <span>{formatCurrency(parcela.valor_base)}</span>
                                                </div>
                                                <div className="flex border-b border-black/30 p-1.5 justify-between italic">
                                                    <span>Condomínio/Outros</span>
                                                    <span>{formatCurrency(Number(parcela.valor_agua) + Number(parcela.valor_luz) + Number(parcela.valor_iptu) + Number(parcela.valor_outros))}</span>
                                                </div>
                                                <div className="mt-auto bg-gray-100 p-2 flex items-center justify-between border-t border-black">
                                                    <span className="font-bold">TOTAL BRUTO</span>
                                                    <span className="font-bold text-sm">{formatCurrency(totalBruto)}</span>
                                                </div>
                                            </div>

                                            <div className="w-1/2 flex flex-col">
                                                <div className="flex border-b border-black">
                                                    <div className="w-1/2 p-2 border-r border-black">
                                                        <span className="font-bold text-[9px] block text-gray-400">VENCIMENTO</span>
                                                        <div className="font-black text-[13px]">{formatDate(parcela.data_vencimento)}</div>
                                                    </div>
                                                    <div className="w-1/2 p-2">
                                                        <span className="font-bold text-[9px] block text-gray-400">REF</span>
                                                        <div className="truncate text-[9px] font-medium">{parcela.descricao || `Parc. ${parcela.numero_parcela}`}</div>
                                                    </div>
                                                </div>
                                                <div className="p-2 border-b border-black flex-1">
                                                    <span className="font-bold text-[9px] block text-gray-400">OBSERVAÇÕES</span>
                                                    <div className="text-[10px] leading-tight mt-1">
                                                        Até o vencimento: desconto de <b>{formatCurrency(desconto)}</b><br />
                                                        Total a pagar: <b className="text-[12px]">{formatCurrency(totalComDesconto)}</b>
                                                    </div>
                                                </div>
                                                <div className="flex h-10">
                                                    <div className="w-1/2 border-r border-black p-1">
                                                        <span className="font-bold text-[8px] block text-gray-300">DATA PAGTO</span>
                                                    </div>
                                                    <div className="w-1/2 p-1">
                                                        <span className="font-bold text-[8px] block text-gray-300">ASSINATURA</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute right-8 bottom-2 text-[8px] text-gray-300 italic">
                                        ID: {parcela.id.slice(0, 8)} | Gerado pelo Sistema de Gestão
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function BulkBoletoPrintPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
            <BulkBoletoPrintContent />
        </Suspense>
    );
}
