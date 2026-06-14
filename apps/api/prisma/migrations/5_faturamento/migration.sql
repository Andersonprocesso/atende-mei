-- Controle de faturamento do MEI + campos de Drive/alerta no cliente.
ALTER TABLE "clientes" ADD COLUMN "driveFolderId" TEXT;
ALTER TABLE "clientes" ADD COLUMN "limiteAlertaEnviado" TEXT;

CREATE TABLE "lancamentos_faturamento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "descricao" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "notaFiscalId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lancamentos_faturamento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lancamentos_faturamento_tenantId_clienteId_ano_idx" ON "lancamentos_faturamento"("tenantId", "clienteId", "ano");
CREATE INDEX "lancamentos_faturamento_tenantId_ano_idx" ON "lancamentos_faturamento"("tenantId", "ano");

ALTER TABLE "lancamentos_faturamento" ADD CONSTRAINT "lancamentos_faturamento_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lancamentos_faturamento" ADD CONSTRAINT "lancamentos_faturamento_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
