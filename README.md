# Atende MEI

SaaS **multi-tenant** com duas camadas:

1. **Bot/assistente no WhatsApp** que atende Microempreendedores Individuais (MEI) de forma conversacional — emissão de NFS-e, guia DAS-MEI, consultor IA, pagamento do plano.
2. **Painel web do contador (o CRM)** que gerencia toda a carteira de clientes MEI — status fiscal, emissões, cobranças/mensalidades, inbox unificada do WhatsApp e métricas.

> Cada **contabilidade é um tenant**; cada **MEI pertence a um tenant**. Todo dado de negócio é isolado por `tenantId`.

---

## Arquitetura

```
atende-mei/
├── docker-compose.yml        # api + web + postgres + redis
├── .env.example              # todas as credenciais via env (nada hardcoded)
└── apps/
    ├── api/                  # NestJS + Prisma (PostgreSQL) — backend e webhooks
    │   ├── prisma/
    │   │   ├── schema.prisma # modelo de dados multi-tenant
    │   │   └── seed.ts       # tenant demo + planos + cliente MEI exemplo
    │   └── src/
    │       ├── main.ts
    │       ├── app.module.ts
    │       ├── prisma/        # PrismaService global
    │       └── modules/
    │           └── health/    # GET /api/health
    └── web/                  # React + Vite + Tailwind — painel do contador
```

### Stack
- **Backend:** Node.js + TypeScript + **NestJS**, **Prisma**, **PostgreSQL**.
- **Frontend:** React + TypeScript + **Vite** + **TailwindCSS**.
- **Filas/jobs (próximas etapas):** BullMQ sobre **Redis** (lembretes DAS, cobrança recorrente).
- **Integrações externas** ficam atrás de interfaces com **adapters "fake"** para desenvolver tudo localmente:
  - `WhatsappProvider` → `mock` | WhatsApp Cloud API (Meta)
  - `AIAssistant` → `mock` | LLM (roteamento de intenções + resposta)
  - `PaymentProvider` → `mock` | Asaas / Mercado Pago / Stripe / Pagar.me (PIX + recorrência)
  - `FiscalProvider` → `fake` | emissor NFS-e municipal/nacional + DAS (Simples Nacional)

---

## Pré-requisitos
- **Docker + Docker Compose** (caminho recomendado), ou
- **Node.js 20+** e um PostgreSQL/Redis locais para rodar sem Docker.

## Subir tudo com Docker (recomendado)

```bash
cp .env.example .env
# gere uma chave de criptografia real (LGPD):
#   openssl rand -hex 32  -> cole em ENCRYPTION_KEY no .env

docker compose up --build
```

- API: http://localhost:3333/api/health
- Painel: http://localhost:5173

As migrations são aplicadas automaticamente ao subir a API (`prisma migrate deploy`).

### Popular dados de exemplo (seed)
```bash
docker compose exec api npx prisma db seed
# Login do painel (etapa 2): admin@demo.com / admin123
```

## Rodar sem Docker (dev local)

```bash
npm install                      # instala workspaces (api + web)
cp .env.example .env             # ajuste DATABASE_URL/REDIS para seu ambiente

# Banco
npm run db:migrate -w apps/api   # cria as tabelas
npm run db:seed -w apps/api      # dados demo

# Subir api + web juntos
npm run dev
```

### Comandos úteis
| Comando | O que faz |
|---|---|
| `npm run dev` | sobe API e painel juntos |
| `npm run db:migrate` | cria/atualiza o schema do banco |
| `npm run db:seed` | popula tenant demo, planos e um MEI |
| `npm run db:studio` | abre o Prisma Studio para inspecionar o banco |
| `npm run test` | testes da API |

---

## Modelo de dados (resumo)

| Modelo | Papel |
|---|---|
| `Tenant` | A contabilidade (unidade de isolamento multi-tenant) |
| `Usuario` | Usuário do painel — papéis `ADMIN`, `CONTADOR`, `ATENDENTE` |
| `Cliente` | O MEI: CNPJ, situação fiscal, metadados do certificado A1 |
| `Conversa` / `Mensagem` | Histórico de WhatsApp + estado da máquina de estados e handoff |
| `NotaFiscal` | NFS-e emitidas (rascunho → emitida/cancelada/erro) |
| `GuiaDAS` | Guias DAS-MEI por competência, vencimento, status |
| `Plano` | Grátis / MEI+ / MEI++ por tenant |
| `Assinatura` | Vínculo cliente↔plano, status e recorrência |
| `Pagamento` | Cobranças — guarda apenas o **link de checkout** do gateway, nunca dados de cartão |
| `AuditLog` | Trilha de auditoria (LGPD) |

O schema completo está em [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma).

---

## Requisitos transversais

- **Multi-tenancy:** todo modelo de negócio carrega `tenantId` e índices por tenant; queries devem ser sempre escopadas (guard/middleware nas próximas etapas).
- **Webhooks idempotentes:** `Mensagem.externalId` e `Pagamento.gatewayRef` têm unicidade por tenant para deduplicar eventos do WhatsApp e do gateway.
- **LGPD:** dados sensíveis (ex.: certificado A1) **não** ficam no banco — apenas um ponteiro (`certificadoRefCofre`) para um cofre/secret manager. `ENCRYPTION_KEY` para criptografia em repouso; `AuditLog` para rastreabilidade.
- **Segredos:** 100% via variáveis de ambiente (`.env`), nada hardcoded.
- **Pagamentos:** o sistema **só gera links de checkout** hospedados pelo gateway e os envia ao cliente pelo WhatsApp; nunca manipula dados de cartão.

---

## Onde plugar os serviços reais

Cada integração tem (ou terá) uma interface + um adapter `fake`/`mock` funcional. Para produção, implemente o adapter real e troque a env correspondente:

| Domínio | Env | Adapter fake | Real (homologação necessária) |
|---|---|---|---|
| WhatsApp | `WHATSAPP_PROVIDER` | `mock` (webhook local) | WhatsApp Business Platform / Cloud API (Meta), templates homologados |
| IA | `AI_PROVIDER` | `mock` (intenções fixas) | LLM (chave em `AI_API_KEY`) |
| Pagamentos | `PAYMENT_PROVIDER` | `mock` (checkout fake) | Asaas / Mercado Pago / Stripe / Pagar.me |
| Fiscal NFS-e | `FISCAL_PROVIDER` | `fake` (gera PDF stub) | Padrão municipal ou Nacional (NFS-e); exige certificado do MEI |
| Fiscal DAS | `FISCAL_PROVIDER` | `fake` | Simples Nacional / Receita Federal |

> ⚠️ Emissão real de NFS-e depende do padrão de cada município (ou do padrão Nacional) e geralmente exige certificado digital do MEI; DAS envolve integração com a Receita/Simples Nacional; WhatsApp em escala exige conta aprovada pela Meta. Por isso a etapa 1 entrega tudo com adapters fake.

---

## Roadmap (etapas)

- [x] **Etapa 1 — Scaffold:** estrutura, Docker, modelos de dados + migrations, health check, painel base.
- [x] **Etapa 2 — CRM:** auth JWT do contador + papéis/permissões (guards globais) + CRUD da carteira de MEIs (filtros/busca/paginação, ficha do cliente, gestão de equipe). **(esta entrega)**
- [ ] **Etapa 3 — WhatsApp:** provider `mock` + máquina de estados de conversa + roteamento de intenções (`AIAssistant`).
- [ ] **Etapa 4 — Fiscal:** fluxos de emissão NFS-e e DAS sobre `FiscalProvider` fake.
- [ ] **Etapa 5 — Cobrança:** planos + assinatura recorrente + envio de checkout pelo WhatsApp + webhook idempotente.
- [ ] **Etapa 6 — Operação:** inbox unificada do WhatsApp + dashboard de métricas (MEIs ativos, MRR, emissões, vencimentos).

---

## Licença
Projeto privado. Inspirado no modelo de produto MEITOR; nenhum código ou ativo do produto original é utilizado.
