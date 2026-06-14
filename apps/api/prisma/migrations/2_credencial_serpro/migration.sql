-- Credenciais SERPRO por tenant, cifradas em repouso.
CREATE TABLE "credenciais_serpro" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerKeyEnc" TEXT,
    "consumerSecretEnc" TEXT,
    "pfxEnc" TEXT,
    "senhaPfxEnc" TEXT,
    "certFingerprint" TEXT,
    "contratanteCnpj" TEXT,
    "autorCnpj" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "credenciais_serpro_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "credenciais_serpro_tenantId_key" ON "credenciais_serpro"("tenantId");

ALTER TABLE "credenciais_serpro" ADD CONSTRAINT "credenciais_serpro_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
