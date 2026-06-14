-- Busca de NF-e de entrada na SEFAZ (NFeDistribuicaoDFe).
ALTER TABLE "clientes" ADD COLUMN "uf" TEXT DEFAULT 'SP';
ALTER TABLE "clientes" ADD COLUMN "nfeUltimoNsu" TEXT DEFAULT '0';

CREATE TABLE "nfe_entradas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nsu" TEXT,
    "modelo" TEXT,
    "situacao" TEXT,
    "emitenteCnpj" TEXT,
    "emitenteNome" TEXT,
    "valorTotal" DECIMAL(12,2),
    "dataEmissao" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nfe_entradas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nfe_entradas_clienteId_chave_key" ON "nfe_entradas"("clienteId", "chave");
CREATE INDEX "nfe_entradas_tenantId_clienteId_idx" ON "nfe_entradas"("tenantId", "clienteId");

ALTER TABLE "nfe_entradas" ADD CONSTRAINT "nfe_entradas_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_entradas" ADD CONSTRAINT "nfe_entradas_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
