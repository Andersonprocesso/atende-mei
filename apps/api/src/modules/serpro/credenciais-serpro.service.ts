import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto.service';

export interface CredenciaisDecifradas {
  consumerKey?: string;
  consumerSecret?: string;
  pfx?: Buffer;
  senhaPfx?: string;
  contratanteCnpj?: string;
  autorCnpj?: string;
}

export interface SalvarCredenciaisInput {
  consumerKey?: string;
  consumerSecret?: string;
  pfxBase64?: string; // conteúdo do .pfx em base64
  senhaPfx?: string;
  contratanteCnpj?: string;
  autorCnpj?: string;
}

// Guarda as credenciais SERPRO cifradas por tenant e as devolve decifradas
// apenas para uso interno (auth). O painel só vê o status, nunca os segredos.
@Injectable()
export class CredenciaisSerproService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cripto: CryptoService,
  ) {}

  async salvar(tenantId: string, input: SalvarCredenciaisInput) {
    const data: Record<string, string | null> = {};

    if (input.consumerKey !== undefined)
      data.consumerKeyEnc = this.cripto.encrypt(input.consumerKey);
    if (input.consumerSecret !== undefined)
      data.consumerSecretEnc = this.cripto.encrypt(input.consumerSecret);
    if (input.senhaPfx !== undefined)
      data.senhaPfxEnc = this.cripto.encrypt(input.senhaPfx);
    if (input.contratanteCnpj !== undefined)
      data.contratanteCnpj = input.contratanteCnpj.replace(/\D/g, '');
    if (input.autorCnpj !== undefined)
      data.autorCnpj = input.autorCnpj.replace(/\D/g, '');

    if (input.pfxBase64) {
      const pfx = Buffer.from(input.pfxBase64, 'base64');
      data.pfxEnc = this.cripto.encrypt(pfx);
      data.certFingerprint = crypto
        .createHash('sha256')
        .update(pfx)
        .digest('hex');
    }

    await this.prisma.credencialSerpro.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
    return this.status(tenantId);
  }

  // Status para o painel — sem expor segredo algum.
  async status(tenantId: string) {
    const c = await this.prisma.credencialSerpro.findUnique({ where: { tenantId } });
    return {
      temConsumerKey: !!c?.consumerKeyEnc && !!c?.consumerSecretEnc,
      temCertificado: !!c?.pfxEnc,
      temSenha: !!c?.senhaPfxEnc,
      certFingerprint: c?.certFingerprint ?? null,
      contratanteCnpj: c?.contratanteCnpj ?? null,
      autorCnpj: c?.autorCnpj ?? null,
      atualizadoEm: c?.atualizadoEm ?? null,
    };
  }

  async carregar(tenantId: string): Promise<CredenciaisDecifradas | null> {
    const c = await this.prisma.credencialSerpro.findUnique({ where: { tenantId } });
    if (!c) return null;
    return {
      consumerKey: c.consumerKeyEnc ? this.cripto.decryptToString(c.consumerKeyEnc) : undefined,
      consumerSecret: c.consumerSecretEnc ? this.cripto.decryptToString(c.consumerSecretEnc) : undefined,
      pfx: c.pfxEnc ? this.cripto.decrypt(c.pfxEnc) : undefined,
      senhaPfx: c.senhaPfxEnc ? this.cripto.decryptToString(c.senhaPfxEnc) : undefined,
      contratanteCnpj: c.contratanteCnpj ?? undefined,
      autorCnpj: c.autorCnpj ?? undefined,
    };
  }
}
