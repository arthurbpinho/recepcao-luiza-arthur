/* =====================================================================
   Cloudflare Worker — backend das confirmações (RSVP) e recados.
   Armazena os dados em um KV namespace (binding: RSVP_KV).
   Segredo da área admin: variável de ambiente ADMIN_PASSWORD.

   Rotas:
     POST /api/rsvp     -> grava uma confirmação
     POST /api/admin    -> { password } => devolve todas as confirmações
   Veja o README.md na raiz para o passo a passo de publicação.
   ===================================================================== */

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign(
      { "Content-Type": "application/json; charset=utf-8" },
      corsHeaders(origin)
    ),
  });
}

function str(v, max) {
  return String(v == null ? "" : v).slice(0, max || 200).trim();
}

async function listPrefix(KV, prefix) {
  var out = [];
  var cursor = undefined;
  do {
    var page = await KV.list({ prefix: prefix, cursor: cursor });
    for (var i = 0; i < page.keys.length; i++) {
      var raw = await KV.get(page.keys[i].name);
      if (raw) {
        try { out.push(JSON.parse(raw)); } catch (e) { /* ignora */ }
      }
    }
    cursor = page.cursor;
    if (page.list_complete) break;
  } while (cursor);
  out.sort(function (a, b) { return (a.createdAt < b.createdAt ? 1 : -1); });
  return out;
}

function keyId() {
  // chave única e ordenável por tempo (Date.now é permitido no Worker)
  return Date.now() + "-" + Math.random().toString(36).slice(2, 9);
}

export default {
  async fetch(request, env) {
    var origin = env.ALLOWED_ORIGIN || "*";
    var url = new URL(request.url);
    var path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (!env.RSVP_KV) {
      return json({ error: "KV namespace não configurado (RSVP_KV)." }, 500, origin);
    }

    try {
      // -------------------- Confirmação (RSVP) --------------------
      if (path === "/api/rsvp" && request.method === "POST") {
        var b = await request.json();
        var name = str(b.name, 120);
        if (!name) return json({ error: "Nome é obrigatório." }, 400, origin);

        var guests = Array.isArray(b.guests)
          ? b.guests.map(function (g) { return str(g, 120); })
                    .filter(Boolean)
                    .slice(0, 20)
          : [];

        var rec = {
          name: name,
          attending: !!b.attending,
          guests: guests,
          createdAt: str(b.createdAt, 40) || new Date().toISOString(),
        };
        await env.RSVP_KV.put("rsvp:" + keyId(), JSON.stringify(rec));
        return json({ ok: true }, 200, origin);
      }

      // -------------------------- Admin ---------------------------
      if (path === "/api/admin" && request.method === "POST") {
        var a = await request.json();
        if (!env.ADMIN_PASSWORD) {
          return json({ error: "ADMIN_PASSWORD não configurada no Worker." }, 500, origin);
        }
        if (str(a.password, 200) !== env.ADMIN_PASSWORD) {
          return json({ error: "Não autorizado." }, 401, origin);
        }
        var rsvps = await listPrefix(env.RSVP_KV, "rsvp:");
        return json({ rsvps: rsvps }, 200, origin);
      }

      return json({ error: "Rota não encontrada." }, 404, origin);
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, 500, origin);
    }
  },
};
