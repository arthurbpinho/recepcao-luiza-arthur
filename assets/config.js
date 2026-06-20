/* =====================================================================
   CONFIGURAÇÃO DO SITE  —  edite os valores abaixo
   ---------------------------------------------------------------------
   workerUrl: deixe "" (vazio) para rodar em MODO DEMO (salva no próprio
   navegador via localStorage — só pra testar o visual).
   Depois de publicar o Cloudflare Worker (veja o README.md), cole aqui
   a URL dele, por exemplo:
       workerUrl: "https://casamento-rsvp.SEU-USUARIO.workers.dev"
   ===================================================================== */
window.WEDDING_CONFIG = {
  // URL do Cloudflare Worker (deixe "" para modo demo)
  workerUrl: "https://casamento-rsvp.artberpinho.workers.dev",

  // Senha do /admin usada APENAS no modo demo (sem Worker).
  // No modo real, a senha de verdade fica no Worker (variável ADMIN_PASSWORD).
  demoAdminPassword: "luiza-arthur-2026",
};
