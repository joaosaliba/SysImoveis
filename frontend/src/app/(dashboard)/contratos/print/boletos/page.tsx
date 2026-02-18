'use client';

import { useEffect, useState, Suspense } from 'react';
import { api } from '@/lib/api';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface BoletoData {
    id: string;
    // ... same as single boleto, we will reuse the layout or structure
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
    qtd_ocupantes?: number;
    periodo_inicio: string;
    periodo_fim: string;
}

// Suspense wrapper for useSearchParams
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
                setTimeout(() => window.print(), 1000);
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
        // Handle ISO T
        const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        const [y, m, day] = d.split('-');
        return `${day}/${m}/${y}`;
    };

    // Helper to chunk array
    const chunk = <T,>(arr: T[], size: number): T[][] =>
        Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

    const boletoGroups = chunk(boletos, 4);

    return (
        <div className="bg-white min-h-screen text-black font-sans">
            <style jsx global>{`
                @page { size: A4; margin: 0; }
                @media print {
                    body { -webkit-print-color-adjust: exact; }
                    .page-container { height: 297mm; page-break-after: always; }
                    .page-container:last-child { page-break-after: auto; }
                }
            `}</style>

            {boletoGroups.map((group, i) => (
                <div key={i} className="page-container flex flex-col w-[200mm] mx-auto bg-white print:w-full">
                    {group.map((parcela, index) => {
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
                            <div key={parcela.id} className="h-[70mm] border-b border-dashed border-gray-400 flex flex-col p-4 box-border relative page-break-inside-avoid">
                                <div className="border border-black h-full flex flex-col text-xs">
                                    {/* Header: Tenant Info */}
                                    <div className="border-b border-black flex bg-gray-50">
                                        <div className="flex-1 p-1 border-r border-black">
                                            <span className="font-bold text-[10px] block text-gray-500">SACADO</span>
                                            <div className="uppercase font-semibold truncate">{parcela.inquilino_nome}</div>
                                        </div>
                                        <div className="w-1/4 p-1">
                                            <span className="font-bold text-[10px] block text-gray-500">CPF</span>
                                            <div>{parcela.inquilino_cpf}</div>
                                        </div>
                                    </div>

                                    {/* Address Row */}
                                    <div className="border-b border-black flex">
                                        <div className="flex-[2] p-1 border-r border-black">
                                            <span className="font-bold text-[10px] block text-gray-500">ENDEREÇO</span>
                                            <div className="truncate">
                                                {parcela.imovel_endereco}, {parcela.imovel_numero} - {parcela.imovel_cidade}
                                            </div>
                                        </div>
                                        <div className="flex-1 p-1">
                                            <span className="font-bold text-[10px] block text-gray-500">UNIDADE</span>
                                            <div>{parcela.tipo_unidade} {parcela.unidade_identificador}</div>
                                        </div>
                                    </div>

                                    {/* Main Content Area */}
                                    <div className="flex flex-1">
                                        {/* Left: Values */}
                                        <div className="w-1/2 border-r border-black flex flex-col">
                                            <div className="flex border-b border-black/50">
                                                <div className="w-2/3 p-1 font-semibold border-r border-black/50">Aluguel</div>
                                                <div className="w-1/3 p-1 text-right">{formatCurrency(parcela.valor_base)}</div>
                                            </div>
                                            <div className="flex border-b border-black/50">
                                                <div className="w-2/3 p-1 font-semibold border-r border-black/50">Condomínio/Outros</div>
                                                <div className="w-1/3 p-1 text-right">
                                                    {formatCurrency(Number(parcela.valor_agua) + Number(parcela.valor_luz) + Number(parcela.valor_iptu) + Number(parcela.valor_outros))}
                                                </div>
                                            </div>

                                            <div className="mt-auto border-t border-black bg-gray-100 flex items-center justify-between p-1">
                                                <span className="font-bold">TOTAL BRUTO</span>
                                                <span className="font-bold text-sm">{formatCurrency(totalBruto)}</span>
                                            </div>
                                        </div>

                                        {/* Right: Dates & Discount */}
                                        <div className="w-1/2 flex flex-col">
                                            <div className="flex border-b border-black">
                                                <div className="w-1/2 p-1 border-r border-black">
                                                    <span className="font-bold text-[10px] block text-gray-500">VENCIMENTO</span>
                                                    <div className="font-bold text-sm">{formatDate(parcela.data_vencimento)}</div>
                                                </div>
                                                <div className="w-1/2 p-1">
                                                    <span className="font-bold text-[10px] block text-gray-500">REF</span>
                                                    <div className="truncate text-[10px]">{parcela.descricao || `Parc. ${parcela.numero_parcela}`}</div>
                                                </div>
                                            </div>

                                            <div className="p-1 border-b border-black flex-1">
                                                <span className="font-bold text-[10px] block text-gray-500">OBSERVAÇÕES</span>
                                                <div className="text-[10px] leading-tight">
                                                    Até o vencimento: desconto de {formatCurrency(desconto)}<br />
                                                    Total a pagar: <b>{formatCurrency(totalComDesconto)}</b>
                                                </div>
                                            </div>

                                            <div className="flex h-8">
                                                <div className="w-1/2 border-r border-black p-1">
                                                    <span className="font-bold text-[8px] block text-gray-500">DATA PAGTO</span>
                                                </div>
                                                <div className="w-1/2 p-1">
                                                    <span className="font-bold text-[8px] block text-gray-500">ASSINATURA</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute right-4 bottom-1 text-[8px] text-gray-400">
                                    ID: {parcela.id.slice(0, 8)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
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
