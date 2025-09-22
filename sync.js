import fetch from "node-fetch";
import crypto from "crypto";

// -------------------------
// Configurações via ambiente
// -------------------------
const publicKey = process.env.BRO_PUBLIC_KEY;
const secretKey = process.env.BRO_SECRET_KEY;
const shopifyToken = process.env.SHOPIFY_TOKEN;
const shopName = process.env.SHOP_NAME;

// Alterna entre "dev" e "prod"
const env = process.env.BRO_ENV || "dev"; // dev = teste, prod = produção
const BRO_API_BASE = env === "prod" ? "https://app.brolexy.com" : "https://dev.brolexy.com";

// -------------------------
// Função para gerar assinatura Brolexy
// -------------------------
function generateSignature(secretKey) {
  const time = Math.floor(Date.now() / 1000).toString();
  const hmac = crypto.createHmac("sha256", secretKey);
  hmac.update(time);
  const signature = hmac.digest("base64");
  return { time, signature };
}

// -------------------------
// Buscar produtos Brolexy
// -------------------------
async function getBrolexyProducts() {
  const { time, signature } = generateSignature(secretKey);

  const res = await fetch(`${BRO_API_BASE}/api/products`, {
    headers: { publicKey, time, signature }
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// -------------------------
// Verifica se produto existe no Shopify pelo SKU
// -------------------------
async function findShopifyProductBySKU(sku) {
  const url = `https://${shopName}.myshopify.com/admin/api/2025-01/products.json?limit=250&fields=id,title,variants`;
  const res = await fetch(url, {
    headers: { "X-Shopify-Access-Token": shopifyToken }
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  for (const product of data.products) {
    for (const variant of product.variants) {
      if (variant.sku === sku) return { product, variant };
    }
  }
  return null;
}

// -------------------------
// Criar ou atualizar produto no Shopify
// -------------------------
async function syncToShopify(product) {
  const sku = `BRO-${product.productId}`;
  const existing = await findShopifyProductBySKU(sku);

  const body = existing
    ? {
        product: {
          id: existing.product.id,
          title: product.name,
          body_html: `Categoria: ${product.category}, Região: ${product.region}`,
          variants: [
            {
              id: existing.variant.id,
              price: product.price,
              inventory_quantity: product.inStock
            }
          ]
        }
      }
    : {
        product: {
          title: product.name,
          body_html: `Categoria: ${product.category}, Região: ${product.region}`,
          variants: [
            {
              price: product.price,
              sku: sku,
              inventory_quantity: product.inStock
            }
          ]
        }
      };

  const url = existing
    ? `https://${shopName}.myshopify.com/admin/api/2025-01/products/${existing.product.id}.json`
    : `https://${shopName}.myshopify.com/admin/api/2025-01/products.json`;

  const res = await fetch(url, {
    method: existing ? "PUT" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": shopifyToken
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// -------------------------
// Fluxo principal
// -------------------------
(async () => {
  try {
    console.log(`🔎 A buscar produtos da Brolexy (${env})...`);
    const products = await getBrolexyProducts();

    for (const p of products) {
      console.log(`➡️  Sincronizando: ${p.name}`);
      await syncToShopify(p);
    }

    console.log("✅ Sincronização concluída!");
  } catch (err) {
    console.error("❌ Erro:", err.message);
  }
})();
