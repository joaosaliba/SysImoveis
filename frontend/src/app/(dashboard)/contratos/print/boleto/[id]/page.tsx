'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface ParcelaDetalhada {
    id: string;
    numero_parcela: number;
    periodo_inicio: string;
    periodo_fim: string;
    valor_base: string;
    valor_iptu: string;
    valor_agua: string;
    valor_luz: string;
    valor_outros: string;
    desconto_pontualidade: string;
    data_vencimento: string;
    data_pagamento: string | null;
    valor_pago: string | null;
    status_pagamento: string;
    descricao?: string;
    observacoes?: string;
    // Relations
    inquilino_nome: string;
    inquilino_cpf: string;
    unidade_identificador: string;
    tipo_unidade: string;
    imovel_endereco: string;
    imovel_numero: string;
    imovel_cidade: string;
    imovel_nome: string;
    qtd_ocupantes?: number;
}

export default function BoletoPrintPage() {
    const { id } = useParams();
    const [parcela, setParcela] = useState<ParcelaDetalhada | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id || id === 'undefined' || id === 'null') {
            setError('ID do boleto inválido.');
            setLoading(false);
            return;
        }
        api.get(`/contratos/parcelas/${id}`)
            .then(data => {
                setParcela(data);
                // Auto-print after a short delay to ensure rendering
                setTimeout(() => window.print(), 500);
            })
            .catch(err => setError('Erro ao carregar boleto.'))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
    if (error) return <div className="flex items-center justify-center h-screen text-red-500">{error}</div>;
    if (!parcela) return null;

    const formatCurrency = (val: string | number) => {
        const num = Number(val) || 0;
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('pt-BR');
    };

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
        <div className="bg-white min-h-screen p-8 print:p-0 text-black font-sans">
            <style jsx global>{`
                @page { size: auto; margin: 0mm; }
                @media print {
                    body { -webkit-print-color-adjust: exact; }
                }
            `}</style>

            <div className="max-w-[210mm] mx-auto border-2 border-black p-1">
                {/* Header: Tenant Info */}
                <div className="border border-black flex">
                    <div className="flex-1 p-1 border-r border-black">
                        <span className="font-bold text-sm block">NOME COMPLETO:</span>
                        <div className="pl-1 uppercase">{parcela.inquilino_nome}</div>
                    </div>
                    <div className="w-1/3 p-1">
                        <span className="font-bold text-sm block">CPF:</span>
                        <div className="pl-1">{parcela.inquilino_cpf}</div>
                    </div>
                </div>

                {/* Address Row */}
                <div className="border-x border-b border-black flex">
                    <div className="flex-[2] p-1 border-r border-black">
                        <span className="font-bold text-sm block">Endereço:</span>
                        <div className="pl-1 text-sm">
                            {parcela.imovel_endereco}
                            {parcela.imovel_nome && ` (${parcela.imovel_nome})`}
                            , {parcela.imovel_cidade}
                        </div>
                    </div>
                    <div className="flex-1 p-1 border-r border-black">
                        <span className="font-bold text-sm block">Tipo:</span>
                        <div className="pl-1 text-sm">{parcela.tipo_unidade} {parcela.unidade_identificador}</div>
                    </div>
                    <div className="w-20 p-1">
                        <span className="font-bold text-sm block">Nº:</span>
                        <div className="pl-1 text-sm">{parcela.imovel_numero}</div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex border-x border-b border-black">
                    {/* Left Column: Breakdown */}
                    <div className="w-1/2 border-r border-black">
                        {/* Table Rows */}
                        <div className="flex border-b border-black">
                            <div className="w-2/3 p-1 font-bold text-sm border-r border-black">Valor do Aluguel:</div>
                            <div className="w-1/3 p-1 text-right">{formatCurrency(parcela.valor_base)}</div>
                        </div>
                        <div className="flex border-b border-black">
                            <div className="w-2/3 p-1 font-bold text-sm border-r border-black">Água:</div>
                            <div className="w-1/3 p-1 text-right">{formatCurrency(parcela.valor_agua)}</div>
                        </div>
                        <div className="flex border-b border-black">
                            <div className="w-2/3 p-1 font-bold text-sm border-r border-black">Luz:</div>
                            <div className="w-1/3 p-1 text-right">{formatCurrency(parcela.valor_luz)}</div>
                        </div>
                        <div className="flex border-b border-black">
                            <div className="w-2/3 p-1 font-bold text-sm border-r border-black">IPTU:</div>
                            <div className="w-1/3 p-1 text-right">{formatCurrency(parcela.valor_iptu)}</div>
                        </div>
                        <div className="flex border-b border-black">
                            <div className="w-2/3 p-1 font-bold text-sm border-r border-black">Outros:</div>
                            <div className="w-1/3 p-1 text-right">{formatCurrency(parcela.valor_outros)}</div>
                        </div>

                        {/* Total Label Row */}
                        <div className="flex border-b border-black bg-gray-100 print:bg-gray-100">
                            <div className="w-full text-center font-bold text-sm p-1">Total Bruto: {formatCurrency(totalBruto)}</div>
                        </div>

                        {/* Discount Box */}
                        <div className="border border-black m-2 p-2">
                            <div className="flex justify-between text-sm">
                                <span>Desconto Pontualidade:</span>
                                <span>{formatCurrency(desconto)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg mt-1 border-t border-black pt-1">
                                <span>Total c/ desconto:</span>
                                <span>{formatCurrency(totalComDesconto)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Other Info */}
                    <div className="w-1/2 flex flex-col">
                        <div className="flex border-b border-black">
                            <div className="w-2/3 p-1 font-bold text-sm border-r border-black text-right">Qtd. Ocupantes:</div>
                            <div className="w-1/3 p-1 text-center">{parcela.qtd_ocupantes || 1}</div>
                        </div>

                        <div className="flex-1 p-2 text-right text-xs text-gray-500">
                            ID: {parcela.id.slice(0, 8)}
                        </div>

                        {/* Period Box */}
                        <div className="border border-black m-2">
                            <div className="flex border-b border-black">
                                <div className="p-1 font-bold text-sm w-20">Período:</div>
                                <div className="p-1 text-sm flex-1 text-center">
                                    {formatDate(parcela.periodo_inicio)} À {formatDate(parcela.periodo_fim)}
                                </div>
                            </div>

                            {/* Payment Rows */}
                            <div className="flex border-b border-black">
                                <div className="w-1/2 p-1 font-bold text-sm border-r border-black">Vencimento:</div>
                                <div className="w-1/2 p-1 text-center font-bold">{formatDate(parcela.data_vencimento)}</div>
                            </div>
                            <div className="flex border-b border-black">
                                <div className="w-1/2 p-1 font-bold text-sm border-r border-black">Data de Pagamento:</div>
                                <div className="w-1/2 p-1 text-center"></div>
                            </div>
                            <div className="flex">
                                <div className="w-1/2 p-1 font-bold text-sm border-r border-black">Valor do Pagamento:</div>
                                <div className="w-1/2 p-1 text-center font-bold"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer / Descrição if avulso */}
                {parcela.descricao && (
                    <div className="border-x border-b border-black p-2 text-sm italic text-center">
                        Ref: {parcela.descricao}
                    </div>
                )}
            </div>

            <div className="mt-8 text-center print:hidden">
                <p className="text-gray-500 text-sm mb-4">A impressão deve iniciar automaticamente...</p>
                <button
                    onClick={() => window.print()}
                    className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                    Imprimir Novamente
                </button>
            </div>
        </div>
    );
}
