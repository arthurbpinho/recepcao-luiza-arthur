/* =====================================================================
   Painel administrativo (/admin) — protegido por senha
   - Lista de presença por pessoa (a partir de guests.js), agrupada por família
   - Status de cada convidado: Vou / Não / Pendente
   - Contadores, busca, download CSV e seção de registros antigos
   - A senha é validada no Cloudflare Worker (modo real) ou localmente (demo)
   ===================================================================== */
(function () {
  "use strict";

  var state = { statusById: {}, rsvps: [], password: "" };
  var el = function (id) { return document.getElementById(id); };

  var GROUPS = (window.WEDDING_GUESTS && window.WEDDING_GUESTS.groups) || [];

  function groupTitle(group) {
    var first = group.members[0] ? group.members[0].name : "Grupo";
    if (group.members.length <= 1) return first;
    return first + " + " + (group.members.length - 1);
  }

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
        ingest(data);
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

  function ingest(data) {
    state.statusById = {};
    (data.guests || []).forEach(function (g) {
      if (g && g.id) state.statusById[g.id] = g;
    });
    state.rsvps = data.rsvps || [];
  }

  /* ------------------------- Recarregar -------------------------- */
  async function reload() {
    try {
      var data = await window.WeddingAPI.fetchAdmin(state.password);
      ingest(data);
      render();
    } catch (e) {
      alert("Não foi possível atualizar os dados.");
    }
  }

  /* -------------------------- Render ----------------------------- */
  function statusOf(memberId) {
    var rec = state.statusById[memberId];
    return rec && (rec.status === "yes" || rec.status === "no") ? rec.status : "pending";
  }

  function render() {
    var yes = 0, no = 0, pending = 0, total = 0;
    GROUPS.forEach(function (g) {
      g.members.forEach(function (m) {
        total++;
        var s = statusOf(m.id);
        if (s === "yes") yes++;
        else if (s === "no") no++;
        else pending++;
      });
    });

    el("stat-yes").textContent = yes;
    el("stat-no").textContent = no;
    el("stat-pending").textContent = pending;
    el("stat-total").textContent = total;

    renderGroups(el("search").value);
    renderLegacy();
  }

  function statusBadge(s) {
    if (s === "yes")
      return '<span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold" style="background:rgba(77,124,15,.14);color:#3f6212">✓ Vou</span>';
    if (s === "no")
      return '<span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold" style="background:rgba(220,38,38,.12);color:#b91c1c">✕ Não</span>';
    return '<span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-500">Pendente</span>';
  }

  function renderGroups(filter) {
    var wrap = el("groups-list");
    var empty = el("groups-empty");
    var q = norm(filter);

    wrap.innerHTML = "";
    var shown = 0;

    GROUPS.forEach(function (g) {
      var match = !q || g.members.some(function (m) { return norm(m.name).indexOf(q) !== -1; });
      if (!match) return;
      shown++;

      var gy = 0, gn = 0, gp = 0;
      g.members.forEach(function (m) {
        var s = statusOf(m.id);
        if (s === "yes") gy++; else if (s === "no") gn++; else gp++;
      });

      var rows = g.members.map(function (m) {
        var rec = state.statusById[m.id];
        var s = statusOf(m.id);
        var when = rec && rec.updatedAt ? fmtDate(rec.updatedAt) : "";
        return (
          '<div class="flex items-center justify-between gap-3 py-2.5">' +
          '<span class="text-olive-dark font-medium">' + esc(m.name) + "</span>" +
          '<div class="flex items-center gap-3">' +
          statusBadge(s) +
          '<span class="text-[11px] text-stone-400 whitespace-nowrap w-28 text-right">' + esc(when) + "</span>" +
          "</div></div>"
        );
      }).join("");

      var card = document.createElement("div");
      card.className = "card p-5";
      card.innerHTML =
        '<div class="flex items-center justify-between gap-3 mb-2">' +
        '<h3 class="font-serif text-xl text-olive-dark">' + esc(groupTitle(g)) + "</h3>" +
        '<span class="text-[11px] text-stone-500 whitespace-nowrap">' +
        gy + " vão · " + gn + " não · " + gp + " pend." +
        "</span></div>" +
        '<div class="divide-y divide-sage-100">' + rows + "</div>";
      wrap.appendChild(card);
    });

    empty.classList.toggle("hidden", shown > 0);
  }

  function renderLegacy() {
    var wrap = el("legacy-wrap");
    var tbody = el("legacy-rows");
    if (!state.rsvps.length) {
      wrap.classList.add("hidden");
      return;
    }
    wrap.classList.remove("hidden");
    tbody.innerHTML = "";
    state.rsvps.forEach(function (r) {
      var badge = r.attending
        ? '<span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sage-100 text-olive-dark">Confirmado</span>'
        : '<span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-500">Não vai</span>';
      var tr = document.createElement("tr");
      tr.className = "hover:bg-sage-50/50";
      tr.innerHTML =
        '<td class="px-4 py-3 font-medium text-olive-dark">' + esc(r.name) + "</td>" +
        '<td class="px-4 py-3">' + badge + "</td>" +
        '<td class="px-4 py-3 text-stone-600">' +
        (r.guests && r.guests.length ? esc(r.guests.join(", ")) : "—") + "</td>" +
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

  function statusLabel(s) {
    return s === "yes" ? "Vou" : s === "no" ? "Não vai" : "Pendente";
  }

  function exportCsv() {
    var header = ["Nome", "Grupo", "Status", "Atualizado em"];
    var lines = [header.join(";")];
    GROUPS.forEach(function (g) {
      var title = groupTitle(g);
      g.members.forEach(function (m) {
        var rec = state.statusById[m.id];
        var s = statusOf(m.id);
        lines.push([
          m.name,
          title,
          statusLabel(s),
          rec && rec.updatedAt ? fmtDate(rec.updatedAt) : "",
        ].map(csvEscape).join(";"));
      });
    });

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
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
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
    el("download-csv").addEventListener("click", exportCsv);
    el("search").addEventListener("input", function () { renderGroups(this.value); });
  });
})();
