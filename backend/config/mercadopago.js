const { MercadoPagoConfig } = require('mercadopago');

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!accessToken) {
    console.warn('⚠️  WARNING: MERCADOPAGO_ACCESS_TOKEN not found in environment variables!');
}

const client = new MercadoPagoConfig({
    accessToken: accessToken || '',
    options: { timeout: 5000 }
});

module.exports = client;