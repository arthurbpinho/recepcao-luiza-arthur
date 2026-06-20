/* =====================================================================
   Lógica da página principal (convite + formulário + recados + folhas)
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

  /* ----------------------- Acompanhantes ------------------------- */
  function setupGuests() {
    var wrap = document.getElementById("guests");
    var addBtn = document.getElementById("add-guest");
    if (!wrap || !addBtn) return;

    addBtn.addEventListener("click", function () {
      var row = document.createElement("div");
      row.className = "flex items-center gap-2 guest-row";
      row.innerHTML =
        '<input type="text" class="field guest-input" placeholder="Nome do cônjuge ou filho(a)" autocomplete="off" />' +
        '<button type="button" class="remove-guest flex-none grid place-items-center w-10 h-10 rounded-xl border border-sage-200 text-olive-dark hover:bg-sage-50 transition" aria-label="Remover">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>' +
        "</button>";
      wrap.appendChild(row);
      var input = row.querySelector(".guest-input");
      input.focus();
      row.querySelector(".remove-guest").addEventListener("click", function () {
        row.remove();
      });
    });
  }

  function collectGuests() {
    var inputs = document.querySelectorAll(".guest-input");
    var list = [];
    inputs.forEach(function (inp) {
      var v = inp.value.trim();
      if (v) list.push(v);
    });
    return list;
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

  /* ----------------------- Formulário RSVP ----------------------- */
  function setupRsvp() {
    var form = document.getElementById("rsvp-form");
    var errorEl = document.getElementById("form-error");
    var submitBtn = document.getElementById("rsvp-submit");
    var successEl = document.getElementById("rsvp-success");
    var demoNote = document.getElementById("demo-note");
    if (!form) return;

    if (!window.WeddingAPI.useWorker && demoNote) {
      demoNote.textContent =
        "⚠️ Modo demonstração: as respostas estão sendo salvas só neste navegador. Configure o Cloudflare Worker para uso real.";
      demoNote.classList.remove("hidden");
    }

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.classList.remove("hidden");
    }

    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      errorEl.classList.add("hidden");

      var name = document.getElementById("name").value.trim();
      var attendingEl = form.querySelector('input[name="attending"]:checked');

      if (!name) return showError("Por favor, preencha seu nome e sobrenome.");
      if (!attendingEl) return showError("Escolha uma das opções de presença.");

      var attending = attendingEl.value === "yes";
      var guests = collectGuests();

      submitBtn.disabled = true;
      submitBtn.querySelector(".btn-label").textContent = "Enviando...";

      try {
        await window.WeddingAPI.submitRsvp({
          name: name,
          attending: attending,
          guests: guests,
        });
        renderSuccess(attending, name, guests);
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.querySelector(".btn-label").textContent = "Enviar resposta";
        showError(
          "Não conseguimos enviar sua resposta. Verifique sua conexão e tente novamente." +
          (err && err.message ? " (" + err.message + ")" : "")
        );
      }
    });

    function renderSuccess(attending, name, guests) {
      form.classList.add("hidden");
      successEl.classList.remove("hidden");

      var totalPeople = 1 + guests.length;
      var names = [name].concat(guests);

      if (attending) {
        successEl.innerHTML =
          '<div class="text-center">' +
          '<div class="mx-auto w-16 h-16 grid place-items-center rounded-full bg-sage-100 text-olive-dark mb-4">' +
          '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg></div>' +
          '<h3 class="font-serif text-3xl text-olive-dark">Obrigado por confirmar sua presença!</h3>' +
          '<p class="text-sm text-stone-600 mt-3 leading-relaxed">Que alegria ter você com a gente, ' +
          escapeHtml(name.split(" ")[0]) + "! 🌿<br />" +
          (totalPeople > 1
            ? "Confirmamos <strong>" + totalPeople + " pessoas</strong>: " + escapeHtml(names.join(", ")) + "."
            : "Sua presença está confirmada.") +
          "</p>" +
          '<div class="mt-5 rounded-xl bg-sage-50 border border-sage-200 px-5 py-4 text-sm text-olive-dark leading-relaxed">' +
          "📅 A <strong>cerimônia</strong> será no dia <strong>18/07 às 19h</strong> e a " +
          "<strong>recepção logo após</strong>. Adicione a data na sua agenda para não esquecer:" +
          "</div>" +
          '<a href="' + googleCalendarUrl() + '" target="_blank" rel="noopener" class="btn btn-olive mt-4 px-7 py-3 text-sm">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' +
          "Adicionar ao Google Agenda</a>" +
          '<p class="text-[12px] text-olive/80 mt-5">Lembrete: o convite é individual e intransferível — haverá lista de presença na portaria.</p>' +
          "</div>";
      } else {
        successEl.innerHTML =
          '<div class="text-center">' +
          '<div class="mx-auto w-16 h-16 grid place-items-center rounded-full bg-sage-100 text-olive-dark mb-4">' +
          '<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7 6 4 10 4 15a8 8 0 0 0 16 0c0-5-3-9-8-13Zm0 4c3 2.7 5 5.6 5 9a5 5 0 0 1-5 5V6Z"/></svg></div>' +
          '<h3 class="font-serif text-3xl text-olive-dark">Obrigado por nos avisar 💚</h3>' +
          '<p class="text-sm text-stone-600 mt-3 leading-relaxed">Vamos sentir sua falta, ' +
          escapeHtml(name.split(" ")[0]) +
          "! Se mais para frente você decidir que conseguirá vir, é só nos avisar " +
          "diretamente <strong class=\"text-olive-dark\">até o dia 5 de julho</strong>. 💚</p>" +
          "</div>";
      }
      successEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
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

  /* --------------------------- Início ---------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    spawnLeaves();
    setupReveal();
    setupGuests();
    setupRsvp();
    setupPix();
  });
})();
