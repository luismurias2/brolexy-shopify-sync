// sync.js
import fetch from 'node-fetch';
import crypto from 'crypto';

// Variáveis de ambiente
const BRO_PUBLIC_KEY = process.env.BRO_PUBLIC_KEY;
const BRO_SECRET_KEY = process.env.BRO_SECRET_KEY;
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE; // ex: "minhaloja.myshopify.com"

// --- 1️⃣ Pegar produtos da Brolexy ---
async function getBrolexyProducts() {
  const time = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHmac('sha256', BRO_SECRET_KEY).update(time).digest('base64');

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
    const err = await res.json().catch(() => ({}));
    throw new Error(JSON.stringify(err));
  }

  const data = await res.json();
  return data;
}

// --- 2️⃣ Criar/atualizar produto no Shopify ---
async function upsertShopifyProduct(product) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2025-01/products.json`;

  const body = {
    product: {
      title: product.name,
      body_html: `<strong>${product.category}</strong> - ${product.region}`,
      variants: [
        {
          price: product.price,
          sku: product.productId,
          inventory_quantity: product.inStock,
          inventory_management: 'shopify'
        }
      ]
    }
  };

  const res = await fetch(url, {
    method: 'POST', // Shopify cria ou atualiza se existir por SKU depois podes melhorar com GET->PATCH
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('Shopify error:', err);
  } else {
    console.log(`Produto enviado: ${product.name}`);
  }
}

// --- 3️⃣ Sync completo ---
async function sync() {
  try {
    console.log('🔎 A buscar produtos da Brolexy...');
    const products = await getBrolexyProducts();

    for (const product of products) {
      await upsertShopifyProduct(product);
    }

    console.log('✅ Sync completo!');
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

// Executar
sync();
