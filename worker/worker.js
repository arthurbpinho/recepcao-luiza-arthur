/* =====================================================================
   Cloudflare Worker — backend das confirmações (RSVP).
   Armazena os dados em um KV namespace (binding: RSVP_KV).
   Segredo da área admin: variável de ambiente ADMIN_PASSWORD.

   Modelo por pessoa (lista fixa de convidados — ver assets/guests.js):
   cada pessoa tem um status "yes"/"no" gravado sob a chave
       guest:<groupId>:<memberId>
   Qualquer pessoa do mesmo grupo pode confirmar/alterar (last-write-wins).

   Rotas:
     POST /api/confirm  -> { groupId, updates:[{id,name,status}] }  grava/atualiza
     POST /api/group    -> { groupId } => status já gravados do grupo
     POST /api/admin    -> { password } => todas as respostas (+ legado)
     POST /api/rsvp     -> (legado) grava uma confirmação em texto livre
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

// id seguro para compor chaves do KV (g1, g1-1, ...)
function safeId(v) {
  return String(v == null ? "" : v).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
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
      // ----------- Confirmação por pessoa (modelo novo) -----------
      if (path === "/api/confirm" && request.method === "POST") {
        var c = await request.json();
        var groupId = safeId(c.groupId);
        if (!groupId) return json({ error: "Grupo inválido." }, 400, origin);

        var updates = Array.isArray(c.updates) ? c.updates.slice(0, 50) : [];
        var now = new Date().toISOString();
        var saved = 0;

        for (var i = 0; i < updates.length; i++) {
          var u = updates[i] || {};
          var id = safeId(u.id);
          var status = str(u.status, 5);
          if (!id || (status !== "yes" && status !== "no")) continue;
          // garante que o id pertence ao grupo informado (id começa com groupId)
          if (id !== groupId && id.indexOf(groupId + "-") !== 0) continue;

          var rec = {
            id: id,
            name: str(u.name, 120),
            groupId: groupId,
            status: status,
            updatedAt: now,
          };
          await env.RSVP_KV.put("guest:" + groupId + ":" + id, JSON.stringify(rec));
          saved++;
        }
        return json({ ok: true, saved: saved }, 200, origin);
      }

      // -------- Status já gravados de um grupo (modelo novo) ------
      if (path === "/api/group" && request.method === "POST") {
        var g = await request.json();
        var gid = safeId(g.groupId);
        if (!gid) return json({ error: "Grupo inválido." }, 400, origin);
        var recs = await listPrefix(env.RSVP_KV, "guest:" + gid + ":");
        var statuses = {};
        recs.forEach(function (r) {
          if (r && r.id) statuses[r.id] = { status: r.status, updatedAt: r.updatedAt };
        });
        return json({ statuses: statuses }, 200, origin);
      }

      // ------------- Confirmação em texto livre (legado) ----------
      if (path === "/api/rsvp" && request.method === "POST") {
        var b = await request.json();
        var name = str(b.name, 120);
        if (!name) return json({ error: "Nome é obrigatório." }, 400, origin);

        var guests = Array.isArray(b.guests)
          ? b.guests.map(function (gg) { return str(gg, 120); })
                    .filter(Boolean)
                    .slice(0, 20)
          : [];

        var lrec = {
          name: name,
          attending: !!b.attending,
          guests: guests,
          createdAt: str(b.createdAt, 40) || new Date().toISOString(),
        };
        await env.RSVP_KV.put("rsvp:" + keyId(), JSON.stringify(lrec));
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
        var guests = await listPrefix(env.RSVP_KV, "guest:");
        var rsvps = await listPrefix(env.RSVP_KV, "rsvp:");
        rsvps.sort(function (x, y) { return (x.createdAt < y.createdAt ? 1 : -1); });
        return json({ guests: guests, rsvps: rsvps }, 200, origin);
      }

      return json({ error: "Rota não encontrada." }, 404, origin);
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, 500, origin);
    }
  },
};
