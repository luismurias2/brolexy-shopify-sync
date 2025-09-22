/**
 * sync.js
 * Sincroniza produtos da Brolexy para Shopify
 */

import fetch from 'node-fetch';
import crypto from 'crypto';

// Environment variables
const BRO_PUBLIC_KEY = process.env.BRO_PUBLIC_KEY;
const BRO_SECRET_KEY = process.env.BRO_SECRET_KEY;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE; // exemplo: "minhaloja"
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN; // Admin API token

if (!BRO_PUBLIC_KEY || !BRO_SECRET_KEY || !SHOPIFY_STORE || !SHOPIFY_TOKEN) {
  console.error("❌ Faltam variáveis de ambiente (BRO_PUBLIC_KEY, BRO_SECRET_KEY, SHOPIFY_STORE, SHOPIFY_TOKEN)");
  process.exit(1);
}

// Função para gerar a assinatura HMAC
function generateSignature(secretKey, timestamp) {
  return crypto.createHmac('sha256', secretKey)
    .update(timestamp.toString())
    .digest('base64');
}

// Função para buscar produtos da Brolexy
async function fetchBrolexyProducts() {
  const time = Math.floor(Date.now() / 1000);
  const signature = generateSignature(BRO_SECRET_KEY, time);

  try {
    const res = await fetch('https://dev.brolexy.com/api/products', {
      method: 'GET',
      headers: {
        'publicKey': BRO_PUBLIC_KEY,
        'time': time,
        'signature': signature,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(JSON.stringify(error));
    }

    const data = await res.json();
    console.log(`✅ ${data.length} produtos encontrados na Brolexy`);
    return data;
  } catch (err) {
    console.error('❌ Erro ao buscar produtos da Brolexy:', err.message);
    return [];
  }
}

// Função para criar/atualizar produto na Shopify
async function upsertShopifyProduct(product) {
  const url = `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2025-01/products.json`;

  const body = {
    product: {
      title: product.name,
      body_html: `<strong>Categoria:</strong> ${product.category}<br><strong>Região:</strong> ${product.region}`,
      variants: [
        {
          price: product.price,
          sku: String(product.productId),
          inventory_quantity: product.inStock,
        }
      ]
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(JSON.stringify(error));
    }

    const result = await res.json();
    console.log(`✅ Produto "${product.name}" enviado para Shopify`);
    return result;
  } catch (err) {
    console.error(`❌ Erro ao enviar "${product.name}" para Shopify:`, err.message);
  }
}

// Função principal
async function main() {
  console.log('🔎 A buscar produtos da Brolexy (dev)...');
  const products = await fetchBrolexyProducts();

  for (const product of products) {
    await upsertShopifyProduct(product);
  }

  console.log('🎉 Sincronização concluída!');
}

// Executa
main();
