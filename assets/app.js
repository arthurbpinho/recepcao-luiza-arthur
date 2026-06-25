/* =====================================================================
   Lógica da página principal
   (convite + escolha do nome na lista + confirmação por pessoa + folhas)
   ===================================================================== */
(function () {
  "use strict";

  /* ----------------------- Folhas caindo ------------------------- */
  // Folha de verdade: corpo em amêndoa (pontas nas duas extremidades),
  // nervura central e nervuras laterais + um pequeno talo.
  function leafSVG(color, vein) {
    return (
      '<svg width="22" height="29" viewBox="0 0 24 32" fill="none">' +
      '<path d="M12 2 C 19.5 9 22 18 12 30 C 2 18 4.5 9 12 2 Z" fill="' + color + '"/>' +
      '<path d="M12 5 V 28 M12 11 L 16.5 8 M12 17 L 17.5 14 M12 23 L 16 21 ' +
      'M12 11 L 7.5 8 M12 17 L 6.5 14 M12 23 L 8 21" stroke="' + vein +
      '" stroke-width="0.9" stroke-linecap="round" opacity="0.55"/>' +
      '<path d="M12 30 V 32" stroke="' + vein + '" stroke-width="1.1" stroke-linecap="round"/>' +
      "</svg>"
    );
  }
  // tons de verde folha + a nervura mais escura para dar profundidade
  var LEAF_TONES = [
    { body: "#7a8a4f", vein: "#46522a" },
    { body: "#90a05b", vein: "#55603c" },
    { body: "#a3b18a", vein: "#5d6a3e" },
    { body: "#677a3c", vein: "#3e472a" },
    { body: "#b3bd86", vein: "#6e7a4f" },
  ];

  function spawnLeaves() {
    var container = document.getElementById("leaves");
    if (!container) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var count = window.innerWidth < 640 ? 9 : 16;
    for (var i = 0; i < count; i++) {
      var leaf = document.createElement("div");
      leaf.className = "leaf" + (i % 2 ? " alt" : "");
      var size = 0.6 + Math.random() * 0.85; // escala
      var dur = 12 + Math.random() * 12; // duração (s) — queda lenta
      var delay = -Math.random() * dur; // começa em pontos diferentes
      var tone = LEAF_TONES[i % LEAF_TONES.length];
      leaf.style.left = Math.random() * 100 + "vw";
      leaf.style.transform = "scale(" + size.toFixed(2) + ")";
      leaf.style.opacity = "0"; // a animação controla a opacidade
      leaf.style.animationDuration = dur.toFixed(1) + "s";
      leaf.style.animationDelay = delay.toFixed(1) + "s";
      leaf.innerHTML = leafSVG(tone.body, tone.vein);
      container.appendChild(leaf);
    }
  }

  /* --------------------- Animações de entrada -------------------- */
  function setupReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    items.forEach(function (el) { io.observe(el); });
  }

  /* --------------------- Link Google Agenda --------------------- */
  function googleCalendarUrl() {
    var params = new URLSearchParams({
      action: "TEMPLATE",
      text: "Casamento de Luiza & Arthur",
      dates: "20260718T190000/20260718T233000",
      ctz: "America/Sao_Paulo",
      details:
        "Cerimônia às 19h. A recepção será logo após a cerimônia.\n\n" +
        "Recepção: Rua Deputado Wilson Tanure, 237 - Santa Amélia, Belo Horizonte - MG, 31560-240",
      location:
        "Av. Augusto de Lima, 1962 - Barro Preto, Belo Horizonte - MG, 30190-008",
    });
    return "https://calendar.google.com/calendar/render?" + params.toString();
  }

  /* ======================= Confirmação =========================== */
  function buildGuestData() {
    var data = window.WEDDING_GUESTS || { groups: [] };
    var groups = {};
    var flat = [];
    (data.groups || []).forEach(function (g) {
      groups[g.id] = g;
      (g.members || []).forEach(function (m) {
        flat.push({ id: m.id, name: m.name, groupId: g.id });
      });
    });
    flat.sort(function (a, b) {
      return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
    });
    return { groups: groups, flat: flat };
  }

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim();
  }

  function setupRsvp() {
    var pickWrap = document.getElementById("rsvp-pick");
    var groupWrap = document.getElementById("rsvp-group");
    var successEl = document.getElementById("rsvp-success");
    if (!pickWrap || !groupWrap || !successEl) return;

    var searchEl = document.getElementById("guest-search");
    var listEl = document.getElementById("guest-list");
    var noneEl = document.getElementById("guest-none");
    var hintEl = document.getElementById("guest-hint");
    var backBtn = document.getElementById("group-back");
    var membersEl = document.getElementById("group-members");
    var errorEl = document.getElementById("group-error");
    var submitBtn = document.getElementById("group-submit");
    var demoNote = document.getElementById("demo-note");

    var data = buildGuestData();
    var selections = {}; // memberId -> "yes" | "no"
    var currentGroup = null;

    if (!window.WeddingAPI.useWorker && demoNote) {
      demoNote.textContent =
        "⚠️ Modo demonstração: as respostas estão sendo salvas só neste navegador. Configure o Cloudflare Worker para uso real.";
      demoNote.classList.remove("hidden");
    }

    /* -------------------- Passo 1: lista de nomes ---------------- */
    function renderList() {
      var q = norm(searchEl.value);
      listEl.innerHTML = "";

      // Enquanto nada foi digitado, mostra só a dica (sem a lista inteira)
      if (!q) {
        listEl.classList.add("hidden");
        noneEl.classList.add("hidden");
        if (hintEl) hintEl.classList.remove("hidden");
        return;
      }
      if (hintEl) hintEl.classList.add("hidden");

      var items = data.flat.filter(function (p) {
        return norm(p.name).indexOf(q) !== -1;
      });
      if (!items.length) {
        listEl.classList.add("hidden");
        noneEl.classList.remove("hidden");
        return;
      }
      noneEl.classList.add("hidden");
      var frag = document.createDocumentFragment();
      items.forEach(function (p) {
        var li = document.createElement("li");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "guest-item";
        btn.setAttribute("data-group", p.groupId);
        btn.innerHTML =
          "<span>" + escapeHtml(p.name) + "</span>" +
          '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>';
        btn.addEventListener("click", function () { openGroup(p.groupId); });
        li.appendChild(btn);
        frag.appendChild(li);
      });
      listEl.appendChild(frag);
      listEl.classList.remove("hidden");
    }

    /* -------------- Passo 2: confirmar pessoas do grupo ---------- */
    function statusButton(member, status, label, icon) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "att-toggle " + status;
      b.setAttribute("data-id", member.id);
      b.setAttribute("data-status", status);
      b.innerHTML = '<span class="ic">' + icon + "</span>" + label;
      b.addEventListener("click", function () {
        selections[member.id] = status;
        errorEl.classList.add("hidden");
        // atualiza o destaque das duas opções desta pessoa
        membersEl
          .querySelectorAll('.att-toggle[data-id="' + cssEsc(member.id) + '"]')
          .forEach(function (el) {
            el.classList.toggle("selected", el.getAttribute("data-status") === status);
          });
      });
      return b;
    }

    function renderMembers(group) {
      membersEl.innerHTML = "";
      group.members.forEach(function (m) {
        var row = document.createElement("div");
        row.className = "member-row";
        var name = document.createElement("p");
        name.className = "font-medium text-olive-dark mb-2.5";
        name.textContent = m.name;
        var opts = document.createElement("div");
        opts.className = "grid grid-cols-2 gap-2";
        opts.appendChild(statusButton(m, "yes", "Vou", "✓"));
        opts.appendChild(statusButton(m, "no", "Não posso", "✕"));
        row.appendChild(name);
        row.appendChild(opts);
        membersEl.appendChild(row);
      });
      applySelections();
    }

    function applySelections() {
      membersEl.querySelectorAll(".att-toggle").forEach(function (el) {
        var id = el.getAttribute("data-id");
        el.classList.toggle(
          "selected",
          selections[id] === el.getAttribute("data-status")
        );
      });
    }

    function openGroup(groupId) {
      var group = data.groups[groupId];
      if (!group) return;
      currentGroup = group;
      selections = {};
      errorEl.classList.add("hidden");
      renderMembers(group);

      pickWrap.classList.add("hidden");
      groupWrap.classList.remove("hidden");
      groupWrap.scrollIntoView({ behavior: "smooth", block: "start" });

      // Busca respostas já gravadas (para quem entra depois do mesmo grupo)
      window.WeddingAPI.fetchGroup(groupId)
        .then(function (res) {
          if (currentGroup !== group) return; // usuário já trocou de grupo
          var st = (res && res.statuses) || {};
          Object.keys(st).forEach(function (id) {
            var s = st[id] && st[id].status;
            // só preenche o que o convidado ainda não tocou nesta sessão
            if ((s === "yes" || s === "no") && !(id in selections)) selections[id] = s;
          });
          applySelections();
        })
        .catch(function () { /* offline/erro: segue com tudo em branco */ });
    }

    function backToList() {
      currentGroup = null;
      searchEl.value = "";
      renderList(); // volta ao estado inicial (só a dica, sem a lista)
      groupWrap.classList.add("hidden");
      pickWrap.classList.remove("hidden");
      pickWrap.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    /* --------------------------- Concluir ----------------------- */
    submitBtn.addEventListener("click", async function () {
      if (!currentGroup) return;
      errorEl.classList.add("hidden");

      var updates = currentGroup.members
        .filter(function (m) { return selections[m.id]; })
        .map(function (m) {
          return { id: m.id, name: m.name, status: selections[m.id] };
        });

      if (!updates.length) {
        errorEl.textContent = "Marque a presença de pelo menos uma pessoa.";
        errorEl.classList.remove("hidden");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.querySelector(".btn-label").textContent = "Enviando...";

      try {
        await window.WeddingAPI.submitConfirm({
          groupId: currentGroup.id,
          updates: updates,
        });
        renderSuccess(updates);
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.querySelector(".btn-label").textContent = "Concluir";
        errorEl.textContent =
          "Não conseguimos salvar as respostas. Verifique sua conexão e tente novamente." +
          (err && err.message ? " (" + err.message + ")" : "");
        errorEl.classList.remove("hidden");
      }
    });

    backBtn.addEventListener("click", backToList);
    searchEl.addEventListener("input", renderList);

    /* ----------------------- Tela de sucesso -------------------- */
    function renderSuccess(updates) {
      groupWrap.classList.add("hidden");
      pickWrap.classList.add("hidden");
      successEl.classList.remove("hidden");

      var going = updates.filter(function (u) { return u.status === "yes"; });
      var notGoing = updates.filter(function (u) { return u.status === "no"; });
      var firstName = (going[0] || updates[0]).name.split(" ")[0];

      var html =
        '<div class="text-center">' +
        '<div class="mx-auto w-16 h-16 grid place-items-center rounded-full bg-sage-100 text-olive-dark mb-4">' +
        (going.length
          ? '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>'
          : '<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7 6 4 10 4 15a8 8 0 0 0 16 0c0-5-3-9-8-13Zm0 4c3 2.7 5 5.6 5 9a5 5 0 0 1-5 5V6Z"/></svg>') +
        "</div>";

      if (going.length) {
        html +=
          '<h3 class="font-serif text-3xl text-olive-dark">Presença confirmada!</h3>' +
          '<p class="text-sm text-stone-600 mt-3 leading-relaxed">Que alegria, ' +
          escapeHtml(firstName) + "! 🌿<br />" +
          (going.length > 1
            ? "Confirmamos <strong>" + going.length + " pessoas</strong>: "
            : "Confirmamos a presença de ") +
          "<strong>" + escapeHtml(going.map(function (u) { return u.name; }).join(", ")) + "</strong>." +
          "</p>";
      } else {
        html +=
          '<h3 class="font-serif text-3xl text-olive-dark">Obrigado por nos avisar 💚</h3>' +
          '<p class="text-sm text-stone-600 mt-3 leading-relaxed">Vamos sentir sua falta! ' +
          "Registramos que " +
          (notGoing.length > 1
            ? "<strong>" + escapeHtml(notGoing.map(function (u) { return u.name; }).join(", ")) + "</strong> não poderão"
            : "<strong>" + escapeHtml(notGoing[0].name) + "</strong> não poderá") +
          " estar presente.</p>";
      }

      // Se confirmou uns e outros não, deixa claro o registro das ausências
      if (going.length && notGoing.length) {
        html +=
          '<p class="text-sm text-stone-500 mt-2 leading-relaxed">Anotamos também que ' +
          (notGoing.length > 1
            ? "<strong>" + escapeHtml(notGoing.map(function (u) { return u.name; }).join(", ")) + "</strong> não poderão vir"
            : "<strong>" + escapeHtml(notGoing[0].name) + "</strong> não poderá vir") +
          ".</p>";
      }

      if (going.length) {
        html +=
          '<div class="mt-5 rounded-xl bg-sage-50 border border-sage-200 px-5 py-4 text-sm text-olive-dark leading-relaxed">' +
          "📅 A <strong>cerimônia</strong> será no dia <strong>18/07 às 19h</strong> e a " +
          "<strong>recepção logo após</strong>. Adicione a data na sua agenda para não esquecer:" +
          "</div>" +
          '<a href="' + googleCalendarUrl() + '" target="_blank" rel="noopener" class="btn btn-olive mt-4 px-7 py-3 text-sm">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' +
          "Adicionar ao Google Agenda</a>";
      }

      // Mensagem comum: pode alterar até 5 de julho
      html +=
        '<p class="mt-6 text-sm text-olive-dark leading-relaxed">Você pode <strong>alterar as respostas</strong> ' +
        "(suas e das pessoas do seu grupo) <strong>até o dia 5 de julho</strong> — é só voltar a este site e escolher o nome de novo.</p>" +
        '<button type="button" id="success-back" class="btn btn-outline mt-4 px-6 py-2.5 text-sm">Alterar respostas</button>' +
        "</div>";

      successEl.innerHTML = html;
      var sb = document.getElementById("success-back");
      if (sb) sb.addEventListener("click", function () {
        successEl.classList.add("hidden");
        submitBtn.disabled = false;
        submitBtn.querySelector(".btn-label").textContent = "Concluir";
        backToList();
      });
      successEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    renderList();
  }

  /* ------------------------- Copiar Pix -------------------------- */
  function setupPix() {
    var btn = document.getElementById("copy-pix");
    var key = document.getElementById("pix-key");
    if (!btn || !key) return;
    btn.addEventListener("click", function () {
      var text = key.textContent.trim();
      var done = function () {
        var old = btn.textContent;
        btn.textContent = "Copiado ✓";
        setTimeout(function () { btn.textContent = old; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        var t = document.createElement("textarea");
        t.value = text;
        document.body.appendChild(t);
        t.select();
        try { document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(t);
        done();
      }
    });
  }

  /* --------------------------- Utils ----------------------------- */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // escape para uso seguro dentro de seletores [data-id="..."]
  function cssEsc(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/["\\]/g, "\\$&");
  }

  /* --------------------------- Início ---------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    spawnLeaves();
    setupReveal();
    setupRsvp();
    setupPix();
  });
})();
