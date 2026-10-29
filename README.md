# Erekoara — API

Node.js + Express + MongoDB, com a mesma arquitetura hexagonal do MEDagenda.

```
app.js                          # helmet, CORS, rate limit, Swagger, seed na 1ª subida
src/
  app/operations/<recurso>/     # casos de uso (1 classe = 1 ação)
  app/services/                 # regras reutilizáveis (detecção de divergência, cadeia de hash, PDF, importação…)
  infrastructure/repositories/  # acesso ao Mongo
  database/models/              # schemas Mongoose
  interfaces/http/              # rotas declarativas + Joi + controllers + middlewares
  lib/                          # logger com request_id, constantes, formatters
scripts/seed.js                 # dados sintéticos (gera também sample-data/*.csv)
```

Injeção de dependência com **awilix** (`src/interfaces/http/container.js`): qualquer arquivo em
`operations/`, `services/`, `repositories/` e `*Controller.js` é registrado pelo nome em camelCase.

## Rodar

```bash
cp .env.example .env    # ajuste os segredos JWT
npm install
npm run seed            # popula se o banco estiver vazio (seed:reset recria)
npm run dev             # http://localhost:3000 · Swagger em /api-docs
```

Docker só da API (usa o Mongo da máquina): `docker compose up -d --build`.

**Produção (Render + MongoDB Atlas):** `render.yaml` + passo a passo em [DEPLOY.md](DEPLOY.md).
`SWAGGER_ENABLED=false` esconde a documentação da API.

## Peças centrais

| Arquivo | Papel |
|---|---|
| `operations/sync/SyncChecksOperation.js` | Sincronização idempotente: `operation_id` único gerado no aparelho; resultado por operação (`applied`, `duplicate_operation`, `duplicate_check`, `rejected`) |
| `services/DiscrepancyDetectionService.js` | Regra pura de divergência (local, unidade, estado, responsável, não cadastrado) |
| `operations/discrepancy/ResolveDiscrepancyOperation.js` | Única porta que altera o cadastro a partir do inventário — sempre com decisão humana registrada |
| `services/HashChainService.js` + `MovementEventService.js` | Histórico de movimentação encadeado por SHA-256 |
| `services/PdfService.js` | Termo de envio/recebimento e relatório de inventário com QR de verificação |
| `services/ImportParserService.js` | CSV/XLSX com reconhecimento automático de colunas, `;`/`,`, Latin-1, datas e valores pt-BR |
| `lib/constants.js` | Tipos de movimentação e nº mínimo de aprovações — **configurável, a validar com o TJPA** |
