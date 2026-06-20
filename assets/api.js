/* =====================================================================
   Cliente de API compartilhado (usado pelo site e pelo /admin).
   Funciona em dois modos:
     - MODO REAL  : envia para o Cloudflare Worker (config.workerUrl)
     - MODO DEMO  : salva no localStorage do próprio navegador
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
      try { return JSON.parse(localStorage.getItem(key) || "[]"); }
      catch (e) { return []; }
    },
    write: function (key, arr) {
      localStorage.setItem(key, JSON.stringify(arr));
    },
  };

  window.WeddingAPI = {
    useWorker: useWorker,

    submitRsvp: async function (data) {
      var rec = Object.assign({ createdAt: new Date().toISOString() }, data);
      if (useWorker) return post("/api/rsvp", rec);
      var arr = demo.read("demo_rsvps");
      arr.push(rec);
      demo.write("demo_rsvps", arr);
      return { ok: true, demo: true };
    },

    fetchAdmin: async function (password) {
      if (useWorker) return post("/api/admin", { password: password });
      if (password !== (cfg.demoAdminPassword || "admin")) {
        var e = new Error("Senha incorreta");
        e.status = 401;
        throw e;
      }
      return { rsvps: demo.read("demo_rsvps"), demo: true };
    },
  };
})();
