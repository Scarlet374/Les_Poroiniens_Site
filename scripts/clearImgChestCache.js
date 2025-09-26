import fetch from "node-fetch";

const ACCOUNT_ID = "46c14f0cf06795811980c89570e0e77c";
const NAMESPACE_ID = "f2e590071fcb42419beaf126408af9b4";
const API_TOKEN = "tArLZtLdVfWyhShCpo3M-I1BCtn8qorFikQjJs6d"; 

async function purgeKV() {
  let cursor = null;
  do {
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/keys`);
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_TOKEN}` }
    });
    const data = await res.json();

    if (!data.success) {
      console.error("Erreur :", data.errors);
      return;
    }

    const keys = data.result.map(k => k.name);
    if (keys.length > 0) {
      console.log(`Suppression de ${keys.length} clés...`);
      await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/bulk`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(keys)
      });
    }

    cursor = data.result_info?.cursor || null;
  } while (cursor);
  
  console.log("✅ KV purgée !");
}

purgeKV();
