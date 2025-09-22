import crypto from "crypto";

// Pega as variáveis de ambiente
const BRO_PUBLIC_KEY = process.env.BRO_PUBLIC_KEY;
const BRO_SECRET_KEY = process.env.BRO_SECRET_KEY;
const BRO_ENV = process.env.BRO_ENV || "dev"; // dev ou prod

if (!BRO_PUBLIC_KEY || !BRO_SECRET_KEY) {
  console.error("❌ BRO_PUBLIC_KEY ou BRO_SECRET_KEY não configuradas!");
  process.exit(1);
}

// URL base dependendo do ambiente
const baseURL = BRO_ENV === "dev" 
  ? "https://dev.brolexy.com/api/products" 
  : "https://app.brolexy.com/api/products";

// Timestamp em segundos
const time = Math.floor(Date.now() / 1000);

// Calcula a assinatura HMAC
let signature;
try {
  signature = crypto
    .createHmac("sha256", BRO_SECRET_KEY)
    .update(String(time))
    .digest("base64");
} catch (err) {
  console.error("❌ Erro ao criar assinatura:", err);
  process.exit(1);
}

// Headers que serão enviados
const headers = {
  "publicKey": BRO_PUBLIC_KEY,
  "time": time,
  "signature": signature
};

console.log("🔹 URL:", baseURL);
console.log("🔹 Headers a enviar:");
console.log(headers);

// Aqui apenas testamos a requisição (não vai dar erro de assinatura ainda)
import fetch from "node-fetch";

(async () => {
  try {
    console.log("🔎 Tentando buscar produtos da Brolexy...");
    const res = await fetch(baseURL, {
      method: "GET",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      }
    });
    
    const data = await res.json();
    console.log("✅ Resposta da API:");
    console.log(data);

  } catch (err) {
    console.error("❌ Erro ao tentar fetch:", err);
  }
})();
