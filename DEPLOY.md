# Deploy — Render (API) + Vercel (app) + MongoDB Atlas (banco)

```
Celular / navegador ──HTTPS──▶ Vercel (app PWA)
        │
        └──────────HTTPS──────▶ Render (API, Docker) ──▶ MongoDB Atlas
```

HTTPS vem de graça na Vercel e no Render — é o que libera **câmera** e **GPS** no navegador.
Sistema fechado: sem cadastro público, CORS só para o domínio da Vercel e Swagger desligado.

## 1. Banco — MongoDB Atlas (gratuito)

1. Crie um cluster **M0** em <https://cloud.mongodb.com>.
2. **Database Access** → crie um usuário com senha.
3. **Network Access** → `0.0.0.0/0` (o Render gratuito não tem IP fixo).
4. **Connect → Drivers** → copie a URI e acrescente o nome do banco:
   `mongodb+srv://USUARIO:SENHA@CLUSTER.mongodb.net/assethub?retryWrites=true&w=majority`

## 2. API — Render

1. Render → **New → Blueprint** → este repositório (`assethub-backend`). Ele lê o `render.yaml`.
2. Preencha o que ele pedir:

| Variável | Valor |
|---|---|
| `MONGODB_URI` | a URI do Atlas (passo 1) |
| `FRONTEND_URL` | domínio da Vercel, ex.: `https://assethub.vercel.app` (sem barra no fim) |
| `PUBLIC_APP_URL` | o mesmo domínio (vai no QR do termo em PDF) |

Os segredos JWT são gerados pelo próprio Render. Na primeira subida (banco vazio) a API cria o
Prédio-Sede e as 5 contas de teste (senha `Patrimonio@2026`).

3. Teste: `https://SEU-APP.onrender.com/health` → `{"status":"ok"...}`.

> Ainda não tem o domínio da Vercel? Suba a API primeiro com qualquer valor, faça o passo 3 e depois
> corrija `FRONTEND_URL` e `PUBLIC_APP_URL` (Render → Environment → Save, ele reinicia sozinho).

## 3. App — Vercel

1. Vercel → **Add New → Project** → repositório `assethub-frontend` (o `vercel.json` já configura tudo).
2. **Environment Variables**:

| Variável | Valor |
|---|---|
| `VITE_API_BASE_URL` | `https://SEU-APP.onrender.com/api/v1` |

3. Deploy. Se trocar a variável depois, faça **Redeploy** (ela entra no build).

## Cuidados para o dia da apresentação

- **O Render gratuito dorme** após 15 min sem uso; a primeira chamada leva ~1 min. Abra o app uns
  2 minutos antes do pitch (ou use um plano pago no dia).
- **Abra o link no Chrome/Safari**, não dentro do WhatsApp/Instagram — esses navegadores embutidos
  costumam bloquear câmera e GPS.
- Na primeira vez o navegador pergunta **"Permitir câmera?"** e **"Permitir localização?"** — toque em Permitir.
- **Ler plaqueta (OCR)** baixa o modelo na primeira vez: faça uma leitura com internet antes de ir a campo.
- **Fixe o ponto da unidade** no local da apresentação: Inventários → abra o inventário →
  **Fixar ponto da unidade aqui** (gerente, com o celular no local). Sem isso, as ações mostram só
  "Localização registrada", sem dizer se foram feitas na unidade.
- Endereços de *preview* da Vercel (`…-git-branch-….vercel.app`) não passam no CORS — use o domínio de produção.
