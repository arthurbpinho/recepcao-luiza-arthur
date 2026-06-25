# Recepção · Luiza & Arthur — site de confirmação de presença

Site estático (HTML + JavaScript + Tailwind) para convidar e confirmar presença
na recepção do casamento, com paleta verde-oliva/creme, folhas caindo e efeitos
nos botões. As respostas e os recados são guardados em um **Cloudflare Worker + KV**
(sem montar banco de dados), e podem ser vistos e baixados na área **`/admin`**.

```
.
├── index.html              ← página principal (convite + lista de nomes p/ confirmar)
├── admin/index.html        ← área dos noivos (acesse digitando /admin), com senha
├── assets/
│   ├── foto.jpg            ← foto dos noivos (versão otimizada p/ web, ~270 KB)
│   ├── config.js           ← VOCÊ EDITA AQUI (URL do Worker + senha do modo demo)
│   ├── guests.js           ← LISTA DE CONVIDADOS (grupos/famílias e seus membros)
│   ├── api.js              ← cliente (fala com o Worker ou usa modo demo)
│   ├── styles.css          ← animações (folhas, hovers, cards)
│   ├── app.js              ← lógica da página principal
│   └── admin.js            ← lógica do /admin
├── worker/
│   ├── worker.js           ← o Cloudflare Worker (backend)
│   └── wrangler.toml       ← config de publicação do Worker
└── README.md
```

---

## 1) Testar agora no seu computador (modo demonstração)

Sem configurar nada, o site já funciona em **modo demo** (as respostas ficam
salvas só no seu navegador, via `localStorage` — serve para ver o visual).

```bash
cd "confirmação casamento"
python3 -m http.server 8000
```

Abra **http://localhost:8000** e, para a área dos noivos, **http://localhost:8000/admin/**
(senha do modo demo definida em `assets/config.js`, padrão: `luiza-arthur-2026`).

> ⚠️ O modo demo **não serve para o casamento de verdade**: cada convidado salvaria
> no próprio celular e você não veria as respostas. Para uso real, faça o passo 2.

---

## 2) Backend de verdade (Cloudflare Worker + KV) — grátis

Isso faz as confirmações de **todos os convidados** caírem num lugar só, que você
vê no `/admin` de qualquer aparelho.

### 2.1 Pré-requisitos
- Uma conta gratuita em https://dash.cloudflare.com (pode criar com o seu Gmail).
- Node.js instalado (você já tem).

### 2.2 Publicar o Worker
No terminal, dentro da pasta `worker/`:

```bash
cd "confirmação casamento/worker"

# 1. Entrar na sua conta Cloudflare (abre o navegador)
npx wrangler login

# 2. Criar o armazenamento KV (guarda as confirmações)
npx wrangler kv namespace create RSVP_KV
```

O comando acima imprime algo como:
```
[[kv_namespaces]]
binding = "RSVP_KV"
id = "abc123def456..."
```
Copie esse **`id`** e cole dentro de `worker/wrangler.toml`, no lugar de
`COLE_AQUI_O_ID_DO_SEU_KV`.

```bash
# 3. Definir a SENHA do /admin (fica secreta no servidor)
npx wrangler secret put ADMIN_PASSWORD
#   -> ele pergunta a senha; digite a que você quiser e tecle Enter.

# 4. Publicar o Worker
npx wrangler deploy
```

No fim, o Wrangler mostra a URL pública do Worker, algo como:
```
https://casamento-rsvp.SEU-USUARIO.workers.dev
```

### 2.3 Conectar o site ao Worker
Abra `assets/config.js` e cole a URL no campo `workerUrl`:

```js
window.WEDDING_CONFIG = {
  workerUrl: "https://casamento-rsvp.SEU-USUARIO.workers.dev",
  demoAdminPassword: "luiza-arthur-2026", // ignorado quando há workerUrl
};
```

Pronto. Agora as confirmações vão para o Worker e o `/admin` lê de lá usando a
senha que você definiu no passo 3 (`ADMIN_PASSWORD`).

> (Opcional) Para aceitar chamadas só do seu site, descomente `ALLOWED_ORIGIN`
> no `wrangler.toml`, ajuste para o seu domínio do GitHub Pages e rode
> `npx wrangler deploy` de novo.

---

## 3) Publicar o site no GitHub Pages

1. Crie um repositório no GitHub e suba **todos os arquivos desta pasta**
   (menos a pasta `worker/`, que é só o backend — pode subir, não atrapalha).
   ```bash
   cd "confirmação casamento"
   git init
   git add .
   git commit -m "Site de confirmação de presença"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
   git push -u origin main
   ```
2. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a
   branch → Branch: `main` / `(root)`** → Save.
3. Em ~1 minuto o site fica no ar em:
   `https://SEU-USUARIO.github.io/SEU-REPO/`
4. A área dos noivos fica em:
   `https://SEU-USUARIO.github.io/SEU-REPO/admin/` (ou digite `/admin`).

> ⚠️ **Importante:** faça o passo 2 (Worker) e cole a `workerUrl` em `config.js`
> **antes** de divulgar o link aos convidados, senão as respostas não chegarão
> até você.

---

## Como o convidado confirma

- Em vez de digitar o nome, o convidado **encontra o próprio nome** numa lista em
  ordem alfabética (com busca) — assim ninguém inclui quem não estava convidado.
- Ao escolher o nome, abre a **lista do grupo/família** dele, com **Vou** (✓ verde)
  e **Não posso** (✕ vermelho) para cada pessoa.
- Pode confirmar só a si ou também os outros do mesmo grupo. Se outra pessoa do
  grupo entrar depois, vê o que já foi marcado e pode **alterar até 5 de julho**.

## Como funciona a área `/admin`

- Acesse digitando `/admin` no final do endereço (sem botão no site, como pedido).
- Pede a **senha** — validada no Worker (no modo demo, a senha do `config.js`).
- Mostra os contadores: **confirmados**, **não vão**, **pendentes** (sem resposta)
  e o **total de convidados** da lista.
- A lista aparece **agrupada por família/grupo**, com o status de cada pessoa.
- **Baixar lista (CSV)** abre direto no Excel/Google Planilhas (com acentos).
- Há busca por nome para encontrar um convidado rapidamente.
- Confirmações enviadas no formato antigo (texto livre), se existirem, aparecem
  numa seção separada no fim da página.

## Detalhes já configurados
- **Data no Google Agenda:** 18/07/2026, 19h (cerimônia), recepção logo após.
- **Cerimônia:** Av. Augusto de Lima, 1962 – Barro Preto, BH (link p/ Google Maps).
- **Recepção:** Rua Deputado Wilson Tanure, 237 – Santa Amélia, BH (link p/ mapa).
- **Pix:** luizacarneiro218@gmail.com (com botão "copiar").
- Aviso de convite **individual e intransferível** + **lista na portaria**.

## Manutenção
- **Editar a lista de convidados:** abra `assets/guests.js`. Cada `group` é uma
  família/círculo que confirma junto; cada `member` tem um `id` **estável** e um
  `name`. Para corrigir um nome, troque só o `name`. Para adicionar um grupo novo,
  use um `id` de grupo inédito (ex.: `g66`) e membros `g66-1`, `g66-2`, … **Não
  reaproveite ids antigos** — eles ligam o nome às confirmações já enviadas.
- **Trocar a foto** dos noivos: substitua `assets/foto.jpg`. Para otimizar uma
  foto nova (deixar leve para celular), rode na raiz do projeto:
  ```bash
  python3 -c "from PIL import Image, ImageOps; im=ImageOps.exif_transpose(Image.open('image/foto.JPG')); w=1600; im=im.resize((w, round(im.height*w/im.width))).convert('RGB'); im.save('assets/foto.jpg','JPEG',quality=82,optimize=True,progressive=True)"
  ```
- Trocar a senha do admin: `cd worker && npx wrangler secret put ADMIN_PASSWORD`.
- Ver os dados crus: painel da Cloudflare → Workers & Pages → KV → namespace `RSVP_KV`.
