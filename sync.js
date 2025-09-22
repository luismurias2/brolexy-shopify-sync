import fetch from "node-fetch";
import crypto from "crypto";

// Variáveis de ambiente
const BRO_ENV = process.env.BRO_ENV || "dev"; // dev ou prod
const BRO_PUBLIC_KEY = process.env.BRO_PUBLIC_KEY;
const BRO_SECRET_KEY = process.env.BRO_SECRET_KEY;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE; // ex: xyxwmb-ep
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;

if (!BRO_PUBLIC_KEY || !BRO_SECRET_KEY || !SHOPIFY_STORE || !SHOPIFY_TOKEN) {
  console.error("❌ Faltam variáveis de ambiente (BRO_PUBLIC_KEY, BRO_SECRET_KEY, SHOPIFY_STORE, SHOPIFY_TOKEN)");
  process.exit(1);
}

// URLs Brolexy
const BRO_URL = BRO_ENV === "dev"
  ? "https://dev.brolexy.com/api/products"
  : "https://app.brolexy.com/api/products";

// URL Shopify
const SHOPIFY_URL = `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2025-01/products.json`;

// Função para gerar assinatura HMAC
function getSignature(secret, time) {
  return crypto.createHmac("sha256", secret).update(time.toString()).digest("base64");
}

async function fetchBrolexyProducts() {
  try {
    const time = Math.floor(Date.now() / 1000);
    const signature = getSignature(BRO_SECRET_KEY, time);

    const res = await fetch(BRO_URL, {
      method: "GET",
      headers: {
        "publicKey": BRO_PUBLIC_KEY,
        "time": time,
        "signature": signature,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(JSON.stringify(err));
    }

    const products = await res.json();
    console.log(`🔎 Encontrados ${products.length} produtos na Brolexy.`);
    return products;
  } catch (err) {
    console.error("❌ Erro ao buscar produtos da Brolexy:", err.message);
    process.exit(1);
  }
}

async function upsertShopifyProduct(product) {
  try {
    const shopifyProduct = {
      product: {
        title: product.name,
        body_html: `Produto da categoria ${product.category} para a região ${product.region}`,
        variants: [
          {
            price: product.price,
            sku: product.productId.toString(),
            inventory_quantity: product.inStock,
          },
        ],
      },
    };

    const res = await fetch(SHOPIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_TOKEN,
      },
      body: JSON.stringify(shopifyProduct),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("❌ Erro ao criar/atualizar produto na Shopify:", err);
      return;
    }

    const created = await res.json();
    console.log(`✅ Produto criado/atualizado: ${created.product.title}`);
  } catch (err) {
    console.error("❌ Erro na Shopify API:", err.message);
  }
}

async function main() {
  const products = await fetchBrolexyProducts();
  for (const product of products) {
    await upsertShopifyProduct(product);
  }
}

main();
