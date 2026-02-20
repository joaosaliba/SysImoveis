'use client';

import React, { useState, useEffect } from 'react';
import { api, getUser, hasRole } from '@/lib/api';

interface Plan {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  intervalo_cobranca: string;
  limite_propriedades: number | null;
  limite_inquilinos: number | null;
  limite_contratos: number | null;
  features: string[];
  ativo: boolean;
}

interface Subscription {
  id: string;
  status: string;
  data_inicio: string;
  data_fim: string | null;
  data_proxima_cobranca: string | null;
  valor_assinatura: number;
  mercadopago_subscription_id: string | null;
}

interface SubscriptionInfo {
  subscription: Subscription | null;
  plan: {
    nome: string;
    descricao: string;
    preco: number;
    intervalo_cobranca: string;
    limite_propriedades: number | null;
    limite_inquilinos: number | null;
    limite_contratos: number | null;
  };
  status: string;
}

const SubscriptionPage = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const user = getUser();

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);

      // Fetch available plans
      const plansResponse = await api.get('/assinaturas/planos');
      setPlans(plansResponse);

      // Fetch current subscription
      const subscriptionResponse = await api.get('/assinaturas/minha-assinatura');
      setCurrentSubscription(subscriptionResponse);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados da assinatura');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!hasRole(['admin', 'gestor'])) {
      setError('Apenas administradores podem gerenciar assinaturas');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/assinaturas/criar-assinatura', { plano_id: planId });

      if (response.success && response.init_point) {
        // Redirect to Mercado Pago for payment
        window.location.href = response.init_point;
      } else {
        alert(response.message || 'Assinatura ativada com sucesso!');
        fetchSubscriptionData();
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao criar assinatura');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePlan = async () => {
    if (!hasRole(['admin', 'gestor']) || !selectedPlan) {
      setError('Apenas administradores podem alterar planos');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/assinaturas/alterar-plano', { plano_id: selectedPlan });

      alert(response.message || 'Plano alterado com sucesso!');
      fetchSubscriptionData();
      setShowConfirm(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar plano');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!hasRole(['admin', 'gestor'])) {
      setError('Apenas administradores podem cancelar assinaturas');
      return;
    }

    if (!window.confirm('Tem certeza que deseja cancelar sua assinatura?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/assinaturas/cancelar-assinatura');

      alert(response.message || 'Assinatura cancelada com sucesso!');
      fetchSubscriptionData();
    } catch (err: any) {
      setError(err.message || 'Erro ao cancelar assinatura');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Gerenciamento de Assinatura</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Current Subscription Info */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Sua Assinatura Atual</h2>

        {currentSubscription ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-medium">Plano:</p>
                <p>{currentSubscription.plan.nome}</p>
              </div>
              <div>
                <p className="font-medium">Status:</p>
                <p className={`font-semibold ${
                  currentSubscription.status === 'active' ? 'text-green-600' :
                  currentSubscription.status === 'trial' ? 'text-blue-600' :
                  currentSubscription.status === 'cancelled' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {currentSubscription.status.charAt(0).toUpperCase() + currentSubscription.status.slice(1)}
                </p>
              </div>

              {currentSubscription.subscription && (
                <>
                  <div>
                    <p className="font-medium">Valor:</p>
                    <p>R$ {currentSubscription.subscription.valor_assinatura.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="font-medium">Próxima cobrança:</p>
                    <p>
                      {currentSubscription.subscription.data_proxima_cobranca
                        ? new Date(currentSubscription.subscription.data_proxima_cobranca).toLocaleDateString('pt-BR')
                        : 'N/A'}
                    </p>
                  </div>
                </>
              )}
            </div>

            {currentSubscription.status === 'active' || currentSubscription.status === 'trial' ? (
              <div className="mt-4 flex space-x-4">
                <button
                  onClick={() => setShowConfirm(true)}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md transition-colors"
                >
                  Alterar Plano
                </button>

                {currentSubscription.subscription?.valor_assinatura > 0 && (
                  <button
                    onClick={handleCancel}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors"
                  >
                    Cancelar Assinatura
                  </button>
                )}
              </div>
            ) : (
              <p className="text-gray-600 mt-2">Assinatura não ativa. Selecione um plano abaixo para continuar usando o sistema.</p>
            )}
          </div>
        ) : (
          <p>Nenhuma assinatura encontrada.</p>
        )}
      </div>

      {/* Available Plans */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Planos Disponíveis</h2>

        {plans.length === 0 ? (
          <p>Nenhum plano disponível no momento.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`border rounded-lg p-6 ${
                  currentSubscription?.plan.nome === plan.nome
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200'
                }`}
              >
                <h3 className="text-lg font-semibold mb-2">{plan.nome}</h3>
                <p className="text-sm text-gray-600 mb-4">{plan.descricao}</p>

                <div className="mb-4">
                  <span className="text-2xl font-bold">
                    {plan.preco === 0 ? 'Grátis' : `R$ ${plan.preco.toFixed(2)}`}
                  </span>
                  {plan.preco > 0 && (
                    <span className="text-gray-600 ml-2">
                      /{plan.intervalo_cobranca === 'monthly' ? 'mês' : 'ano'}
                    </span>
                  )}
                </div>

                <ul className="mb-6 space-y-2">
                  <li><strong>Propriedades:</strong> {plan.limite_propriedades ? `${plan.limite_propriedades}` : 'Ilimitado'}</li>
                  <li><strong>Inquilinos:</strong> {plan.limite_inquilinos ? `${plan.limite_inquilinos}` : 'Ilimitado'}</li>
                  <li><strong>Contratos:</strong> {plan.limite_contratos ? `${plan.limite_contratos}` : 'Ilimitado'}</li>
                  {plan.features.map((feature, idx) => (
                    <li key={idx}>• {feature}</li>
                  ))}
                </ul>

                {currentSubscription?.plan.nome !== plan.nome && (
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={!hasRole(['admin', 'gestor'])}
                    className={`w-full py-2 px-4 rounded-md ${
                      hasRole(['admin', 'gestor'])
                        ? 'bg-blue-500 hover:bg-blue-600 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    } transition-colors`}
                  >
                    {plan.preco === 0 ? 'Ativar Plano Gratuito' : 'Assinar este plano'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plan Change Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Alterar Plano</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Selecione o novo plano:</label>
              <select
                value={selectedPlan || ''}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">Selecione um plano</option>
                {plans
                  .filter(plan => plan.nome !== currentSubscription?.plan.nome)
                  .map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.nome} - R$ {plan.preco.toFixed(2)}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setSelectedPlan(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangePlan}
                disabled={!selectedPlan}
                className={`px-4 py-2 rounded-md ${
                  selectedPlan
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPage;