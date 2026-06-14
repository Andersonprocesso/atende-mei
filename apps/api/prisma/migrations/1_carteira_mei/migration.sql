-- Carteira de MEIs: telefone opcional (MEI importado pode não ter WhatsApp)
-- + vínculo com a Omie e CPF do titular.
ALTER TABLE "clientes" ALTER COLUMN "telefoneWa" DROP NOT NULL;
ALTER TABLE "clientes" ADD COLUMN "cpfProprietario" TEXT;
ALTER TABLE "clientes" ADD COLUMN "omieCodigoCliente" TEXT;
