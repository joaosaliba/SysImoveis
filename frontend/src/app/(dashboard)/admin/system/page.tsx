'use client';

import React, { useState, useEffect } from 'react';
import { api, isSystemAdmin } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Realm {
    id: string;
    nome: string;
    slug: string;
    status_assinatura: string;
    created_at: string;
    plano_nome: string | null;
    plano_preco: number | null;
    assinatura_fim: string | null;
    total_propriedades: number;
    total_inquilinos: number;
    total_contratos: number;
}

interface Stats {
    total_realms: number;
    total_users: number;
    total_propriedades: number;
    total_inquilinos: number;
    total_revenue: number | null;
    active_subscribers: number;
}

const SystemAdminPage = () => {
    const [realms, setRealms] = useState<Realm[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (!isSystemAdmin()) {
            router.replace('/dashboard');
            return;
        }
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [realmsData, statsData] = await Promise.all([
                api.get('/system/realms'),
                api.get('/system/stats')
            ]);
            setRealms(realmsData);
            setStats(statsData);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar dados do sistema');
        } finally {
            setLoading(false);
        }
    };

    const handleGrantAccess = async (realmId: string) => {
        try {
            const planId = prompt('Digite o ID do plano (ou deixe em branco para manter o atual):');
            if (planId === null) return;

            await api.post(`/system/realms/${realmId}/subscription`, {
                status: 'active',
                plano_id: planId || undefined,
                data_fim: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // +1 year
            });
            alert('Acesso concedido com sucesso!');
            fetchData();
        } catch (err: any) {
            alert(err.message || 'Erro ao atualizar acesso');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-8">Painel do Sistema (Global Admin)</h1>

            {/* Global Stats */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    {[
                        { label: 'Empresas', value: stats.total_realms },
                        { label: 'Usuários', value: stats.total_users },
                        { label: 'Propriedades', value: stats.total_propriedades },
                        { label: 'Inquilinos', value: stats.total_inquilinos },
                        { label: 'Assinantes Ativos', value: stats.active_subscribers },
                        { label: 'Receita Total', value: `R$ ${(stats.total_revenue || 0).toFixed(2)}` },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500">{stat.label}</p>
                            <p className="text-xl font-bold">{stat.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-100">
                    {error}
                </div>
            )}

            {/* Realms Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-600">
                            <th className="px-6 py-4">Empresa</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Plano</th>
                            <th className="px-6 py-4">Uso (Im/In/Co)</th>
                            <th className="px-6 py-4">Criado em</th>
                            <th className="px-6 py-4">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {realms.map((realm) => (
                            <tr key={realm.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-semibold">{realm.nome}</p>
                                    <p className="text-xs text-gray-400">{realm.slug}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${realm.status_assinatura === 'active' ? 'bg-green-100 text-green-700' :
                                            realm.status_assinatura === 'trial' ? 'bg-blue-100 text-blue-700' :
                                                realm.status_assinatura === 'past_due' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-red-100 text-red-700'
                                        }`}>
                                        {realm.status_assinatura}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-sm">{realm.plano_nome || 'Nenhum'}</p>
                                    {realm.assinatura_fim && (
                                        <p className="text-xs text-gray-400">Expira: {new Date(realm.assinatura_fim).toLocaleDateString()}</p>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    {realm.total_propriedades} / {realm.total_inquilinos} / {realm.total_contratos}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {new Date(realm.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => handleGrantAccess(realm.id)}
                                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                    >
                                        Dar Acesso
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SystemAdminPage;
