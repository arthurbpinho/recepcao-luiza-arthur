/* =====================================================================
   Cliente de API compartilhado (usado pelo site e pelo /admin).
   Funciona em dois modos:
     - MODO REAL  : envia para o Cloudflare Worker (config.workerUrl)
     - MODO DEMO  : salva no localStorage do próprio navegador

   Modelo novo: cada pessoa da lista tem um status ("yes" | "no"). As
   respostas são gravadas por pessoa (id estável vindo de guests.js) e
   podem ser atualizadas depois por qualquer pessoa do mesmo grupo.
   ===================================================================== */
(function () {
  var cfg = window.WEDDING_CONFIG || {};
  var useWorker = !!(cfg.workerUrl && cfg.workerUrl.trim());
  var base = (cfg.workerUrl || "").replace(/\/+$/, "");

  async function post(path, body) {
    var res = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    var data = null;
    try { data = await res.json(); } catch (e) { /* sem corpo */ }
    if (!res.ok) {
      var err = new Error((data && data.error) || "Erro " + res.status);
      err.status = res.status;
      throw err;
    }
    return data || { ok: true };
  }

  var demo = {
    read: function (key) {
      try { return JSON.parse(localStorage.getItem(key) || "null"); }
      catch (e) { return null; }
    },
    write: function (key, val) {
      localStorage.setItem(key, JSON.stringify(val));
    },
    guests: function () {
      return demo.read("demo_guests") || {};
    },
  };

  window.WeddingAPI = {
    useWorker: useWorker,

    /* Confirma/atualiza o status de pessoas de UM grupo.
       payload = { groupId, updates: [{ id, name, status }] }  status: "yes"|"no" */
    submitConfirm: async function (payload) {
      if (useWorker) return post("/api/confirm", payload);
      var all = demo.guests();
      var now = new Date().toISOString();
      (payload.updates || []).forEach(function (u) {
        all[u.id] = {
          id: u.id,
          name: u.name,
          groupId: payload.groupId,
          status: u.status,
          updatedAt: now,
        };
      });
      demo.write("demo_guests", all);
      return { ok: true, demo: true };
    },

    /* Lê os status já gravados de um grupo (para quem entra depois ver). */
    fetchGroup: async function (groupId) {
      if (useWorker) return post("/api/group", { groupId: groupId });
      var all = demo.guests();
      var statuses = {};
      Object.keys(all).forEach(function (id) {
        var r = all[id];
        if (r && r.groupId === groupId) {
          statuses[id] = { status: r.status, updatedAt: r.updatedAt };
        }
      });
      return { statuses: statuses, demo: true };
    },

    /* Painel: todas as respostas por pessoa (+ eventuais registros antigos). */
    fetchAdmin: async function (password) {
      if (useWorker) return post("/api/admin", { password: password });
      if (password !== (cfg.demoAdminPassword || "admin")) {
        var e = new Error("Senha incorreta");
        e.status = 401;
        throw e;
      }
      return {
        guests: Object.values(demo.guests()),
        rsvps: demo.read("demo_rsvps") || [],
        demo: true,
      };
    },
  };
})();
