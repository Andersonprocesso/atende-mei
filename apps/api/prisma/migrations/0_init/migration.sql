-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CONTADOR', 'ATENDENTE');

-- CreateEnum
CREATE TYPE "SituacaoFiscal" AS ENUM ('REGULAR', 'PENDENTE', 'IRREGULAR', 'DESCONHECIDA');

-- CreateEnum
CREATE TYPE "PlanoTier" AS ENUM ('GRATIS', 'MEI_PLUS', 'MEI_PLUS_PLUS');

-- CreateEnum
CREATE TYPE "AssinaturaStatus" AS ENUM ('ATIVA', 'INADIMPLENTE', 'CANCELADA', 'TRIAL');

-- CreateEnum
CREATE TYPE "CanalConversa" AS ENUM ('WHATSAPP');

-- CreateEnum
CREATE TYPE "DirecaoMensagem" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "RemetenteTipo" AS ENUM ('CLIENTE', 'BOT', 'ATENDENTE');

-- CreateEnum
CREATE TYPE "ConversaStatus" AS ENUM ('BOT', 'HUMANO', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "NotaFiscalStatus" AS ENUM ('RASCUNHO', 'EMITIDA', 'CANCELADA', 'ERRO');

-- CreateEnum
CREATE TYPE "GuiaDASStatus" AS ENUM ('GERADA', 'PAGA', 'VENCIDA', 'ERRO');

-- CreateEnum
CREATE TYPE "PagamentoTipo" AS ENUM ('MENSALIDADE', 'AVULSO');

-- CreateEnum
CREATE TYPE "PagamentoStatus" AS ENUM ('PENDENTE', 'PAGO', 'FALHOU', 'ESTORNADO');

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('PIX', 'CARTAO', 'BOLETO');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CONTADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cnpj" TEXT,
    "razaoSocial" TEXT,
    "nomeFantasia" TEXT,
    "nomeContato" TEXT,
    "telefoneWa" TEXT NOT NULL,
    "email" TEXT,
    "situacaoFiscal" "SituacaoFiscal" NOT NULL DEFAULT 'DESCONHECIDA',
    "certificadoNome" TEXT,
    "certificadoValidade" TIMESTAMP(3),
    "certificadoRefCofre" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "canal" "CanalConversa" NOT NULL DEFAULT 'WHATSAPP',
    "status" "ConversaStatus" NOT NULL DEFAULT 'BOT',
    "estado" TEXT,
    "contexto" JSONB,
    "atendenteId" TEXT,
    "ultimaMsgEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "direcao" "DirecaoMensagem" NOT NULL,
    "remetente" "RemetenteTipo" NOT NULL,
    "externalId" TEXT,
    "conteudo" TEXT NOT NULL,
    "anexos" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_fiscais" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "numero" TEXT,
    "tomadorNome" TEXT NOT NULL,
    "tomadorDoc" TEXT,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "status" "NotaFiscalStatus" NOT NULL DEFAULT 'RASCUNHO',
    "pdfUrl" TEXT,
    "providerRef" TEXT,
    "emitidaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_fiscais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guias_das" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "linhaDigitavel" TEXT,
    "pdfUrl" TEXT,
    "status" "GuiaDASStatus" NOT NULL DEFAULT 'GERADA',
    "providerRef" TEXT,
    "pagaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guias_das_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tier" "PlanoTier" NOT NULL,
    "nome" TEXT NOT NULL,
    "precoMensal" DECIMAL(10,2) NOT NULL,
    "recursos" JSONB,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "status" "AssinaturaStatus" NOT NULL DEFAULT 'TRIAL',
    "gatewayRef" TEXT,
    "inicioEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proximaCobrancaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "assinaturaId" TEXT,
    "tipo" "PagamentoTipo" NOT NULL DEFAULT 'MENSALIDADE',
    "metodo" "MetodoPagamento" NOT NULL DEFAULT 'PIX',
    "valor" DECIMAL(12,2) NOT NULL,
    "status" "PagamentoStatus" NOT NULL DEFAULT 'PENDENTE',
    "checkoutUrl" TEXT,
    "gatewayRef" TEXT,
    "pagoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT,
    "entidadeId" TEXT,
    "dados" JSONB,
    "ip" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_cnpj_key" ON "tenants"("cnpj");

-- CreateIndex
CREATE INDEX "usuarios_tenantId_idx" ON "usuarios"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_tenantId_email_key" ON "usuarios"("tenantId", "email");

-- CreateIndex
CREATE INDEX "clientes_tenantId_idx" ON "clientes"("tenantId");

-- CreateIndex
CREATE INDEX "clientes_tenantId_situacaoFiscal_idx" ON "clientes"("tenantId", "situacaoFiscal");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_tenantId_cnpj_key" ON "clientes"("tenantId", "cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_tenantId_telefoneWa_key" ON "clientes"("tenantId", "telefoneWa");

-- CreateIndex
CREATE INDEX "conversas_tenantId_idx" ON "conversas"("tenantId");

-- CreateIndex
CREATE INDEX "conversas_tenantId_status_idx" ON "conversas"("tenantId", "status");

-- CreateIndex
CREATE INDEX "conversas_clienteId_idx" ON "conversas"("clienteId");

-- CreateIndex
CREATE INDEX "mensagens_conversaId_idx" ON "mensagens"("conversaId");

-- CreateIndex
CREATE INDEX "mensagens_tenantId_idx" ON "mensagens"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "mensagens_tenantId_externalId_key" ON "mensagens"("tenantId", "externalId");

-- CreateIndex
CREATE INDEX "notas_fiscais_tenantId_idx" ON "notas_fiscais"("tenantId");

-- CreateIndex
CREATE INDEX "notas_fiscais_tenantId_status_idx" ON "notas_fiscais"("tenantId", "status");

-- CreateIndex
CREATE INDEX "notas_fiscais_clienteId_idx" ON "notas_fiscais"("clienteId");

-- CreateIndex
CREATE INDEX "guias_das_tenantId_idx" ON "guias_das"("tenantId");

-- CreateIndex
CREATE INDEX "guias_das_tenantId_status_idx" ON "guias_das"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "guias_das_clienteId_competencia_key" ON "guias_das"("clienteId", "competencia");

-- CreateIndex
CREATE INDEX "planos_tenantId_idx" ON "planos"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "planos_tenantId_tier_key" ON "planos"("tenantId", "tier");

-- CreateIndex
CREATE INDEX "assinaturas_tenantId_idx" ON "assinaturas"("tenantId");

-- CreateIndex
CREATE INDEX "assinaturas_tenantId_status_idx" ON "assinaturas"("tenantId", "status");

-- CreateIndex
CREATE INDEX "assinaturas_clienteId_idx" ON "assinaturas"("clienteId");

-- CreateIndex
CREATE INDEX "pagamentos_tenantId_idx" ON "pagamentos"("tenantId");

-- CreateIndex
CREATE INDEX "pagamentos_tenantId_status_idx" ON "pagamentos"("tenantId", "status");

-- CreateIndex
CREATE INDEX "pagamentos_clienteId_idx" ON "pagamentos"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_tenantId_gatewayRef_key" ON "pagamentos"("tenantId", "gatewayRef");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_entidade_entidadeId_idx" ON "audit_logs"("tenantId", "entidade", "entidadeId");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_atendenteId_fkey" FOREIGN KEY ("atendenteId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_das" ADD CONSTRAINT "guias_das_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_das" ADD CONSTRAINT "guias_das_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos" ADD CONSTRAINT "planos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "planos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_assinaturaId_fkey" FOREIGN KEY ("assinaturaId") REFERENCES "assinaturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

