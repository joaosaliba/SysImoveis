'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Building2, Users, FileText, AlertTriangle, DollarSign, ArrowRight, DoorOpen, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement } from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement);

interface DashboardStats {
    total_propriedades: number;
    total_unidades: number;
    total_inquilinos: number;
    contratos_ativos: number;
    parcelas_atrasadas: number;
    receita_mensal: number;
}

interface OcupacaoData {
    total: number;
    alugadas: number;
    disponiveis: number;
    manutencao: number;
    taxa_ocupacao: string;
}

interface ReceitaMensalData {
    mes: string;
    total: number;
}

interface ContratosStatusData {
    status: string;
    total: number;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [ocupacao, setOcupacao] = useState<OcupacaoData | null>(null);
    const [receitaMensal, setReceitaMensal] = useState<ReceitaMensalData[]>([]);
    const [contratosStatus, setContratosStatus] = useState<ContratosStatusData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get('/dashboard'),
            api.get('/dashboard/ocupacao'),
            api.get('/dashboard/receita-mensal'),
            api.get('/dashboard/contratos-status'),
        ])
            .then(([statsRes, ocupacaoRes, receitaRes, statusRes]) => {
                setStats(statsRes);
                setOcupacao(ocupacaoRes);
                setReceitaMensal(receitaRes);
                setContratosStatus(statusRes);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const cards = stats ? [
        {
            title: 'Imóveis',
            value: stats.total_propriedades,
            icon: Building2,
            color: 'from-blue-500 to-blue-600',
            shadow: 'shadow-blue-500/25',
            href: '/imoveis',
        },
        {
            title: 'Unidades',
            value: stats.total_unidades,
            icon: DoorOpen,
            color: 'from-amber-500 to-amber-600',
            shadow: 'shadow-amber-500/25',
            href: '/imoveis',
        },
        {
            title: 'Inquilinos',
            value: stats.total_inquilinos,
            icon: Users,
            color: 'from-emerald-500 to-emerald-600',
            shadow: 'shadow-emerald-500/25',
            href: '/inquilinos',
        },
        {
            title: 'Contratos Ativos',
            value: stats.contratos_ativos,
            icon: FileText,
            color: 'from-violet-500 to-violet-600',
            shadow: 'shadow-violet-500/25',
            href: '/contratos',
        },
        {
            title: 'Parcelas Atrasadas',
            value: stats.parcelas_atrasadas,
            icon: AlertTriangle,
            color: stats.parcelas_atrasadas > 0 ? 'from-red-500 to-red-600' : 'from-gray-400 to-gray-500',
            shadow: stats.parcelas_atrasadas > 0 ? 'shadow-red-500/25' : 'shadow-gray-400/25',
            href: '/boletos?status=atrasado',
        },
    ] : [];

    // Chart data
    const ocupacaoChartData = ocupacao ? {
        labels: ['Alugadas', 'Disponíveis', 'Manutenção'],
        datasets: [{
            label: 'Unidades',
            data: [ocupacao.alugadas, ocupacao.disponiveis, ocupacao.manutencao],
            backgroundColor: [
                'rgba(34, 197, 94, 0.8)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(234, 179, 8, 0.8)',
            ],
            borderColor: [
                'rgb(34, 197, 94)',
                'rgb(59, 130, 246)',
                'rgb(234, 179, 8)',
            ],
            borderWidth: 2,
        }],
    } : null;

    const receitaChartData = receitaMensal.length > 0 ? {
        labels: receitaMensal.map(r => r.mes),
        datasets: [{
            label: 'Receita (R$)',
            data: receitaMensal.map(r => r.total),
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
        }],
    } : null;

    const contratosStatusChartData = contratosStatus.length > 0 ? {
        labels: contratosStatus.map(c => c.status),
        datasets: [{
            label: 'Contratos',
            data: contratosStatus.map(c => c.total),
            backgroundColor: [
                'rgba(34, 197, 94, 0.8)',
                'rgba(234, 179, 8, 0.8)',
                'rgba(239, 68, 68, 0.8)',
                'rgba(107, 114, 128, 0.8)',
            ],
            borderColor: [
                'rgb(34, 197, 94)',
                'rgb(234, 179, 8)',
                'rgb(239, 68, 68)',
                'rgb(107, 114, 128)',
            ],
            borderWidth: 2,
        }],
    } : null;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom' as const,
            },
        },
    };

    return (
        <div className="space-y-8 pt-10 md:pt-0">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text)]">Dashboard</h1>
                <p className="text-[var(--color-text-muted)] mt-1">Visão geral do sistema</p>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-36 rounded-2xl bg-white animate-pulse" />
                    ))}
                </div>
            ) : (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-6">
                        {cards.map((card) => {
                            const Icon = card.icon;
                            return (
                                <Link
                                    key={card.title}
                                    href={card.href}
                                    className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.color} p-6 text-white
                    shadow-lg ${card.shadow} hover:shadow-xl hover:scale-[1.02] transition-all duration-300`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm text-white/80 font-medium">{card.title}</p>
                                            <p className="text-3xl font-bold mt-1">{card.value}</p>
                                        </div>
                                        <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                                            <Icon className="w-6 h-6" />
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center gap-1 text-sm text-white/70 group-hover:text-white/90">
                                        <span>Ver detalhes</span>
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                    {/* Decorative circle */}
                                    <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-white/10" />
                                </Link>
                            );
                        })}
                    </div>

                    {/* Revenue Card */}
                    {stats && (
                        <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-green-50">
                                    <DollarSign className="w-7 h-7 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-[var(--color-text-muted)] font-medium">Receita do Mês Atual</p>
                                    <p className="text-3xl font-bold text-[var(--color-text)]">
                                        R$ {stats.receita_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Occupancy Pie Chart */}
                        {ocupacao && ocupacaoChartData && (
                            <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-blue-50">
                                            <PieChartIcon className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-semibold text-[var(--color-text)]">Ocupação das Unidades</h3>
                                            <p className="text-xs text-[var(--color-text-muted)]">
                                                Taxa: <span className="font-semibold text-green-600">{ocupacao.taxa_ocupacao}%</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-64">
                                    <Pie data={ocupacaoChartData} options={chartOptions} />
                                </div>
                            </div>
                        )}

                        {/* Contracts Status Bar Chart */}
                        {contratosStatus.length > 0 && contratosStatusChartData && (
                            <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-violet-50">
                                        <FileText className="w-5 h-5 text-violet-600" />
                                    </div>
                                    <h3 className="text-base font-semibold text-[var(--color-text)]">Status dos Contratos</h3>
                                </div>
                                <div className="h-64">
                                    <Bar data={contratosStatusChartData} options={{ ...chartOptions, plugins: { legend: { display: false } } }} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Revenue Line Chart */}
                    {receitaMensal.length > 0 && receitaChartData && (
                        <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-green-50">
                                    <TrendingUp className="w-5 h-5 text-green-600" />
                                </div>
                                <h3 className="text-base font-semibold text-[var(--color-text)]">Receita Mensal (Últimos 12 meses)</h3>
                            </div>
                            <div className="h-72">
                                <Line data={receitaChartData} options={chartOptions} />
                            </div>
                        </div>
                    )}

                    {/* Quick Actions */}
                    <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-8">
                        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Ações Rápidas</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Link
                                href="/imoveis?new=true"
                                className="flex items-center gap-3 p-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)]
                  hover:bg-blue-50/50 transition-all duration-200 group"
                            >
                                <Building2 className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)]" />
                                <span className="text-sm font-medium">Novo Imóvel</span>
                            </Link>
                            <Link
                                href="/inquilinos?new=true"
                                className="flex items-center gap-3 p-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)]
                  hover:bg-blue-50/50 transition-all duration-200 group"
                            >
                                <Users className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)]" />
                                <span className="text-sm font-medium">Novo Inquilino</span>
                            </Link>
                            <Link
                                href="/contratos?new=true"
                                className="flex items-center gap-3 p-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)]
                  hover:bg-blue-50/50 transition-all duration-200 group"
                            >
                                <FileText className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)]" />
                                <span className="text-sm font-medium">Novo Contrato</span>
                            </Link>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
