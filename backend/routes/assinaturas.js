const express = require('express');
const pool = require('../db/pool');
const client = require('../config/mercadopago');
const { PreApproval, Payment } = require('mercadopago');
const { verifyToken, checkRole, isAdmin, isMaster } = require('../middleware/auth');
const moment = require('moment');

const preApproval = new PreApproval(client);
const payment = new Payment(client);

const router = express.Router();

// Get all subscription plans
router.get('/planos', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, nome, descricao, preco, intervalo_cobranca,
                   limite_propriedades, limite_inquilinos, limite_contratos,
                   features, ativo, created_at, updated_at
            FROM planos
            WHERE ativo = true
            ORDER BY preco ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching plans:', error);
        res.status(500).json({ error: 'Erro ao buscar planos de assinatura.' });
    }
});

// Get user's current subscription
router.get('/minha-assinatura', verifyToken, async (req, res) => {
    try {
        const { realm_id } = req.user;

        const result = await pool.query(`
            SELECT a.*, p.nome as plano_nome, p.descricao as plano_descricao,
                   p.preco as plano_preco, p.intervalo_cobranca as plano_intervalo,
                   p.limite_propriedades, p.limite_inquilinos, p.limite_contratos
            FROM assinaturas a
            JOIN planos p ON a.plano_id = p.id
            WHERE a.realm_id = $1
            ORDER BY a.data_inicio DESC
            LIMIT 1
        `, [realm_id]);

        if (result.rows.length === 0) {
            // Return default basic plan for trial users
            const basicPlanResult = await pool.query(
                'SELECT * FROM planos WHERE preco = 0 ORDER BY created_at LIMIT 1'
            );

            return res.json({
                subscription: null,
                plan: basicPlanResult.rows[0],
                status: 'trial',
                remaining_days: 30 // 30 days trial
            });
        }

        const subscription = result.rows[0];
        res.json({
            subscription: subscription,
            plan: {
                nome: subscription.plano_nome,
                descricao: subscription.plano_descricao,
                preco: subscription.plano_preco,
                intervalo_cobranca: subscription.plano_intervalo,
                limite_propriedades: subscription.limite_propriedades,
                limite_inquilinos: subscription.limite_inquilinos,
                limite_contratos: subscription.limite_contratos
            },
            status: subscription.status
        });
    } catch (error) {
        console.error('Error fetching user subscription:', error);
        res.status(500).json({ error: 'Erro ao buscar informações da assinatura.' });
    }
});

// Create subscription with Mercado Pago
router.post('/criar-assinatura', verifyToken, isMaster, async (req, res) => {
    try {
        const { plano_id } = req.body;
        const { id: usuario_id, realm_id } = req.user;

        // Get plan details
        const planResult = await pool.query('SELECT * FROM planos WHERE id = $1 AND ativo = true', [plano_id]);
        if (planResult.rows.length === 0) {
            return res.status(404).json({ error: 'Plano não encontrado.' });
        }

        const plan = planResult.rows[0];

        // Cancel any existing active subscriptions
        await pool.query(`
            UPDATE assinaturas
            SET status = 'cancelled', data_fim = NOW()
            WHERE realm_id = $1 AND status = 'active'
        `, [realm_id]);

        // Create Mercado Pago subscription
        if (plan.preco > 0) {
            // Prepare Mercado Pago subscription item
            const subscriptionBody = {
                reason: `SysImóveis - ${plan.nome}`,
                external_reference: `${realm_id}_${Date.now()}`,
                items: [
                    {
                        id: plan.id,
                        title: plan.nome,
                        quantity: 1,
                        unit_price: parseFloat(plan.preco)
                    }
                ],
                payer: {
                    id: usuario_id
                },
                back_url: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/assinaturas/webhook`,
                auto_recurring: {
                    frequency: plan.intervalo_cobranca === 'monthly' ? 1 : 12,
                    frequency_type: 'months',
                    transaction_amount: parseFloat(plan.preco),
                    currency_id: 'BRL',
                    start_date: new Date().toISOString(),
                    end_date: null // Unlimited duration
                }
            };

            // Create subscription in Mercado Pago
            const mpSub = await preApproval.create({ body: subscriptionBody });

            // Save to our database
            const subscriptionResult = await pool.query(`
                INSERT INTO assinaturas
                (usuario_id, plano_id, realm_id, status, mercadopago_subscription_id,
                 mercadopago_plan_id, data_inicio, data_proxima_cobranca, valor_assinatura)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `, [
                usuario_id,
                plano_id,
                realm_id,
                'pending', // Will be updated when webhook receives confirmation
                mpSub.id,
                plan.id,
                new Date(),
                moment().add(1, plan.intervalo_cobranca === 'monthly' ? 'month' : 'year').toDate(),
                plan.preco
            ]);

            // Update realm with current subscription info
            await pool.query(`
                UPDATE realms
                SET assinatura_atual_id = $1, status_assinatura = 'pending'
                WHERE id = $2
            `, [subscriptionResult.rows[0].id, realm_id]);

            res.json({
                success: true,
                subscription: subscriptionResult.rows[0],
                init_point: mpSub.init_point, // Redirect URL for payment
                message: 'Assinatura criada com sucesso. Redirecione o usuário para completar o pagamento.'
            });
        } else {
            // Free plan - activate immediately
            const subscriptionResult = await pool.query(`
                INSERT INTO assinaturas
                (usuario_id, plano_id, realm_id, status, data_inicio, data_proxima_cobranca, valor_assinatura)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [
                usuario_id,
                plano_id,
                realm_id,
                'active',
                new Date(),
                null, // No next billing for free plan
                plan.preco
            ]);

            // Update realm with current subscription info
            await pool.query(`
                UPDATE realms
                SET assinatura_atual_id = $1, status_assinatura = 'active'
                WHERE id = $2
            `, [subscriptionResult.rows[0].id, realm_id]);

            // Update user subscription start date
            await pool.query(
                'UPDATE usuarios SET data_inicio_assinatura = $1 WHERE realm_id = $2',
                [new Date(), realm_id]
            );

            res.json({
                success: true,
                subscription: subscriptionResult.rows[0],
                message: 'Plano gratuito ativado com sucesso.'
            });
        }
    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(500).json({ error: 'Erro ao criar assinatura.' });
    }
});

// Upgrade/downgrade subscription
router.post('/alterar-plano', verifyToken, isMaster, async (req, res) => {
    try {
        const { plano_id } = req.body;
        const { id: usuario_id, realm_id } = req.user;

        // Get current active subscription
        const currentSubResult = await pool.query(`
            SELECT * FROM assinaturas
            WHERE realm_id = $1 AND status = 'active'
            ORDER BY data_inicio DESC LIMIT 1
        `, [realm_id]);

        if (currentSubResult.rows.length === 0) {
            return res.status(404).json({ error: 'Nenhuma assinatura ativa encontrada.' });
        }

        const currentSubscription = currentSubResult.rows[0];

        // Get new plan details
        const planResult = await pool.query('SELECT * FROM planos WHERE id = $1 AND ativo = true', [plano_id]);
        if (planResult.rows.length === 0) {
            return res.status(404).json({ error: 'Plano não encontrado.' });
        }

        const newPlan = planResult.rows[0];

        // Update Mercado Pago subscription if it's a paid plan
        let updatedMpSub = null;
        if (currentSubscription.mercadopago_subscription_id && newPlan.preco > 0) {
            // Modify the existing subscription in Mercado Pago
            updatedMpSub = await preApproval.update({
                id: currentSubscription.mercadopago_subscription_id,
                body: {
                    reason: `SysImóveis - ${newPlan.nome}`,
                    auto_recurring: {
                        transaction_amount: parseFloat(newPlan.preco),
                        frequency: newPlan.intervalo_cobranca === 'monthly' ? 1 : 12,
                        frequency_type: 'months',
                        currency_id: 'BRL'
                    }
                }
            });
        }

        // Cancel current subscription
        await pool.query(`
            UPDATE assinaturas
            SET status = 'cancelled', data_fim = NOW()
            WHERE id = $1
        `, [currentSubscription.id]);

        // Create new subscription
        const newSubResult = await pool.query(`
            INSERT INTO assinaturas
            (usuario_id, plano_id, realm_id, status, mercadopago_subscription_id,
             mercadopago_plan_id, data_inicio, data_proxima_cobranca, valor_assinatura)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            usuario_id,
            plano_id,
            realm_id,
            'active', // New subscription starts as active
            currentSubscription.mercadopago_subscription_id, // Reuse same MP subscription ID
            newPlan.id,
            new Date(),
            moment().add(1, newPlan.intervalo_cobranca === 'monthly' ? 'month' : 'year').toDate(),
            newPlan.preco
        ]);

        // Update realm with new subscription info
        await pool.query(`
            UPDATE realms
            SET assinatura_atual_id = $1, status_assinatura = 'active'
            WHERE id = $2
        `, [newSubResult.rows[0].id, realm_id]);

        res.json({
            success: true,
            old_subscription: currentSubscription,
            new_subscription: newSubResult.rows[0],
            message: 'Plano alterado com sucesso.'
        });
    } catch (error) {
        console.error('Error changing plan:', error);
        res.status(500).json({ error: 'Erro ao alterar plano de assinatura.' });
    }
});

// Cancel subscription
router.post('/cancelar-assinatura', verifyToken, isMaster, async (req, res) => {
    try {
        const { realm_id } = req.user;

        // Get current active subscription
        const currentSubResult = await pool.query(`
            SELECT * FROM assinaturas
            WHERE realm_id = $1 AND status = 'active'
            ORDER BY data_inicio DESC LIMIT 1
        `, [realm_id]);

        if (currentSubResult.rows.length === 0) {
            return res.status(404).json({ error: 'Nenhuma assinatura ativa encontrada.' });
        }

        const currentSubscription = currentSubResult.rows[0];

        // Cancel in Mercado Pago if it's a paid subscription
        if (currentSubscription.mercadopago_subscription_id) {
            await preApproval.update({
                id: currentSubscription.mercadopago_subscription_id,
                body: {
                    status: 'cancelled'
                }
            });
        }

        // Update our database
        await pool.query(`
            UPDATE assinaturas
            SET status = 'cancelled', data_fim = NOW()
            WHERE id = $1
        `, [currentSubscription.id]);

        // Update realm status
        await pool.query(`
            UPDATE realms
            SET status_assinatura = 'cancelled'
            WHERE id = $1
        `, [realm_id]);

        res.json({
            success: true,
            message: 'Assinatura cancelada com sucesso.'
        });
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        res.status(500).json({ error: 'Erro ao cancelar assinatura.' });
    }
});

// Get billing history
router.get('/historico-pagamentos', verifyToken, async (req, res) => {
    try {
        const { realm_id } = req.user;

        const result = await pool.query(`
            SELECT p.*, s.mercadopago_subscription_id, pl.nome as plano_nome
            FROM pagamentos p
            JOIN assinaturas s ON p.assinatura_id = s.id
            JOIN planos pl ON s.plano_id = pl.id
            WHERE p.realm_id = $1
            ORDER BY p.created_at DESC
        `, [realm_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico de pagamentos.' });
    }
});

// Webhook endpoint for Mercado Pago notifications
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const { topic, resource } = req.body;

        if (topic === 'subscription') {
            // Handle subscription updates
            const subscriptionId = resource.id;

            // Get the subscription from our DB
            const dbSubResult = await pool.query(
                'SELECT * FROM assinaturas WHERE mercadopago_subscription_id = $1',
                [subscriptionId]
            );

            if (dbSubResult.rows.length > 0) {
                const dbSub = dbSubResult.rows[0];

                // Get updated subscription info from Mercado Pago
                const mpSub = await preApproval.get({ id: subscriptionId });

                // Update status based on MP subscription status
                let newStatus = dbSub.status;
                switch (mpSub.status) {
                    case 'active':
                        newStatus = 'active';
                        break;
                    case 'cancelled':
                        newStatus = 'cancelled';
                        break;
                    case 'paused':
                        newStatus = 'suspended';
                        break;
                    case 'pending':
                        newStatus = 'pending';
                        break;
                    case 'deactivated':
                        newStatus = 'expired';
                        break;
                }

                // Update database
                await pool.query(`
                    UPDATE assinaturas
                    SET status = $1, data_proxima_cobranca = $2
                    WHERE id = $3
                `, [
                    newStatus,
                    mpSub.next_payer_date ? new Date(mpSub.next_payer_date) : null,
                    dbSub.id
                ]);

                // Update realm status
                await pool.query(`
                    UPDATE realms
                    SET status_assinatura = $1
                    WHERE id = $2
                `, [newStatus, dbSub.realm_id]);

                console.log(`Webhook: Updated subscription ${subscriptionId} to status ${newStatus}`);
            }
        } else if (topic === 'payment') {
            // Handle payment updates
            const paymentId = resource.id;

            // Get payment from MP
            const mpPayment = await payment.get({ id: paymentId });

            // Check if we already have this payment recorded
            const existingPayment = await pool.query(
                'SELECT id FROM pagamentos WHERE mercadopago_payment_id = $1',
                [paymentId]
            );

            if (existingPayment.rows.length > 0) {
                // Update existing payment
                await pool.query(`
                    UPDATE pagamentos
                    SET status = $1, data_pagamento = $2, dados_pagamento = $3
                    WHERE mercadopago_payment_id = $4
                `, [
                    mpPayment.status,
                    mpPayment.date_approved ? new Date(mpPayment.date_approved) : null,
                    JSON.stringify(mpPayment),
                    paymentId
                ]);
            } else {
                // Find subscription by MP subscription ID
                const subResult = await pool.query(
                    'SELECT id FROM assinaturas WHERE mercadopago_subscription_id = $1',
                    [mpPayment.subscription_id]
                );

                if (subResult.rows.length > 0) {
                    const subscriptionId = subResult.rows[0].id;

                    // Get realm_id from subscription
                    const realmResult = await pool.query(
                        'SELECT realm_id FROM assinaturas WHERE id = $1',
                        [subscriptionId]
                    );

                    // Create new payment record
                    await pool.query(`
                        INSERT INTO pagamentos
                        (assinatura_id, realm_id, mercadopago_payment_id, mercadopago_invoice_id,
                         valor, status, data_pagamento, data_vencimento, dados_pagamento)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    `, [
                        subscriptionId,
                        realmResult.rows[0].realm_id,
                        paymentId,
                        mpPayment.invoice_id || null,
                        mpPayment.transaction_amount,
                        mpPayment.status,
                        mpPayment.date_approved ? new Date(mpPayment.date_approved) : null,
                        new Date(mpPayment.date_created), // Use creation date as due date initially
                        JSON.stringify(mpPayment)
                    ]);
                }
            }

            console.log(`Webhook: Processed payment ${paymentId} with status ${mpPayment.status}`);
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Erro no webhook.' });
    }
});

// Check if user has access based on subscription status
router.get('/verificar-acesso', verifyToken, async (req, res) => {
    try {
        const { realm_id } = req.user;

        const result = await pool.query(`
            SELECT r.status_assinatura, a.valor_assinatura, p.limite_propriedades, p.limite_inquilinos, p.limite_contratos
            FROM realms r
            LEFT JOIN assinaturas a ON r.assinatura_atual_id = a.id
            LEFT JOIN planos p ON a.plano_id = p.id
            WHERE r.id = $1
        `, [realm_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Realm não encontrado.' });
        }

        const realm = result.rows[0];
        const hasAccess = ['active', 'trial'].includes(realm.status_assinatura);

        // Get current usage to check limits
        const [propertiesCount, tenantsCount, contractsCount] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM propriedades WHERE realm_id = $1', [realm_id]),
            pool.query('SELECT COUNT(*) as count FROM inquilinos WHERE realm_id = $1', [realm_id]),
            pool.query('SELECT COUNT(*) as count FROM contratos WHERE realm_id = $1', [realm_id])
        ]);

        const usage = {
            propriedades: parseInt(propertiesCount.rows[0].count),
            inquilinos: parseInt(tenantsCount.rows[0].count),
            contratos: parseInt(contractsCount.rows[0].count),
            limite_propriedades: realm.limite_propriedades,
            limite_inquilinos: realm.limite_inquilinos,
            limite_contratos: realm.limite_contratos
        };

        // Check if user exceeded limits
        const limitsExceeded = realm.limite_propriedades !== null && usage.propriedades >= realm.limite_propriedades ||
            realm.limite_inquilinos !== null && usage.inquilinos >= realm.limite_inquilinos ||
            realm.limite_contratos !== null && usage.contratos >= realm.limite_contratos;

        res.json({
            has_access: hasAccess && !limitsExceeded,
            status_assinatura: realm.status_assinatura,
            valor_assinatura: realm.valor_assinatura,
            usage: usage,
            limits_exceeded: limitsExceeded
        });
    } catch (error) {
        console.error('Error checking access:', error);
        res.status(500).json({ error: 'Erro ao verificar acesso.' });
    }
});

module.exports = router;