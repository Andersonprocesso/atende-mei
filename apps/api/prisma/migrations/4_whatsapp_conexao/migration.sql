-- Estado da conexão Baileys (WhatsApp) por tenant.
CREATE TABLE "whatsapp_conexoes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DESCONECTADO',
    "numero" TEXT,
    "qrcode" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_conexoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_conexoes_tenantId_key" ON "whatsapp_conexoes"("tenantId");

ALTER TABLE "whatsapp_conexoes" ADD CONSTRAINT "whatsapp_conexoes_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
