-- Certificado A1 individual do MEI, cifrado em repouso.
ALTER TABLE "clientes" ADD COLUMN "certificadoPfxEnc" TEXT;
ALTER TABLE "clientes" ADD COLUMN "certificadoSenhaEnc" TEXT;
ALTER TABLE "clientes" ADD COLUMN "certificadoFingerprint" TEXT;
