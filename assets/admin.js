/* =====================================================================
   Painel administrativo (/admin) — protegido por senha
   - Lista de presença, contadores e download CSV
   - A senha é validada no Cloudflare Worker (modo real) ou localmente (demo)
   ===================================================================== */
(function () {
  "use strict";

  var state = { rsvps: [], password: "" };
  var el = function (id) { return document.getElementById(id); };

  /* --------------------------- Login ----------------------------- */
  function setupLogin() {
    var form = el("login-form");
    var error = el("login-error");
    var btn = el("login-btn");
    var modeEl = el("login-mode");

    modeEl.textContent = window.WeddingAPI.useWorker
      ? "Conectado ao servidor (Cloudflare Worker)."
      : "Modo demonstração (dados deste navegador).";

    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      error.classList.add("hidden");
      var pass = el("password").value;
      btn.disabled = true;
      btn.querySelector(".btn-label").textContent = "Entrando...";
      try {
        var data = await window.WeddingAPI.fetchAdmin(pass);
        state.password = pass;
        state.rsvps = data.rsvps || [];
        el("login").classList.add("hidden");
        el("panel").classList.remove("hidden");
        if (data.demo) {
          var banner = el("demo-banner");
          banner.textContent =
            "⚠️ Modo demonstração: mostrando apenas os dados salvos neste navegador.";
          banner.classList.remove("hidden");
        }
        render();
      } catch (err) {
        error.textContent =
          err && err.status === 401
            ? "Senha incorreta. Tente novamente."
            : "Erro ao entrar" + (err && err.message ? ": " + err.message : ".");
        error.classList.remove("hidden");
      } finally {
        btn.disabled = false;
        btn.querySelector(".btn-label").textContent = "Entrar";
      }
    });
  }

  /* ------------------------- Recarregar -------------------------- */
  async function reload() {
    try {
      var data = await window.WeddingAPI.fetchAdmin(state.password);
      state.rsvps = data.rsvps || [];
      render();
    } catch (e) {
      alert("Não foi possível atualizar os dados.");
    }
  }

  /* -------------------------- Render ----------------------------- */
  function peopleCount(r) {
    return 1 + (Array.isArray(r.guests) ? r.guests.length : 0);
  }

  function render() {
    var yes = state.rsvps.filter(function (r) { return r.attending; });
    var no = state.rsvps.filter(function (r) { return !r.attending; });
    var people = yes.reduce(function (sum, r) { return sum + peopleCount(r); }, 0);

    el("stat-yes").textContent = yes.length;
    el("stat-no").textContent = no.length;
    el("stat-people").textContent = people;

    renderRows(el("search").value);
  }

  function renderRows(filter) {
    var tbody = el("rsvp-rows");
    var empty = el("rsvp-empty");
    var q = (filter || "").trim().toLowerCase();

    var rows = state.rsvps
      .slice()
      .sort(function (a, b) { return (a.createdAt < b.createdAt ? 1 : -1); })
      .filter(function (r) {
        if (!q) return true;
        var hay = (r.name + " " + (r.guests || []).join(" ")).toLowerCase();
        return hay.indexOf(q) !== -1;
      });

    tbody.innerHTML = "";
    if (!rows.length) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    rows.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.className = "hover:bg-sage-50/50";
      var badge = r.attending
        ? '<span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sage-100 text-olive-dark">Confirmado</span>'
        : '<span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-500">Não vai</span>';
      tr.innerHTML =
        '<td class="px-4 py-3 font-medium text-olive-dark">' + esc(r.name) + "</td>" +
        '<td class="px-4 py-3">' + badge + "</td>" +
        '<td class="px-4 py-3 text-stone-600">' +
        (r.guests && r.guests.length ? esc(r.guests.join(", ")) : "—") + "</td>" +
        '<td class="px-4 py-3 text-stone-600">' + peopleCount(r) + "</td>" +
        '<td class="px-4 py-3 text-stone-500 whitespace-nowrap">' + fmtDate(r.createdAt) + "</td>";
      tbody.appendChild(tr);
    });
  }

  /* ---------------------------- CSV ------------------------------ */
  function csvEscape(v) {
    v = v == null ? "" : String(v);
    if (/[",\n;]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
    return v;
  }

  function exportRsvps() {
    var rows = state.rsvps
      .slice()
      .sort(function (a, b) { return (a.createdAt < b.createdAt ? 1 : -1); })
      .map(function (r) {
        return [
          r.name,
          r.attending ? "Confirmado" : "Não vai",
          (r.guests || []).join(", "),
          peopleCount(r),
          fmtDate(r.createdAt),
        ];
      });

    var header = ["Nome", "Status", "Acompanhantes", "Total de pessoas", "Enviado em"];
    var lines = [header.join(";")];
    rows.forEach(function (cols) { lines.push(cols.map(csvEscape).join(";")); });

    // BOM para o Excel reconhecer acentos
    var blob = new Blob(["﻿" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "confirmacoes-luiza-arthur.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* --------------------------- Utils ----------------------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  /* --------------------------- Início ---------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    setupLogin();
    el("refresh").addEventListener("click", reload);
    el("logout").addEventListener("click", function () { location.reload(); });
    el("download-csv").addEventListener("click", exportRsvps);
    el("search").addEventListener("input", function () { renderRows(this.value); });
  });
})();
