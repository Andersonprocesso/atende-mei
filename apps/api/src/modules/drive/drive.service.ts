import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GoogleDriveClient } from './google-drive.client';

const RAIZ = 'AtendeMEI';

@Injectable()
export class DriveService {
  private readonly logger = new Logger('Drive');
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    this.clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') ?? '';
    this.refreshToken = config.get<string>('GOOGLE_REFRESH_TOKEN') ?? '';
  }

  get configurado(): boolean {
    return !!this.clientId && !!this.clientSecret && !!this.refreshToken;
  }

  private async conectar(): Promise<GoogleDriveClient> {
    return GoogleDriveClient.conectar(this.clientId, this.clientSecret, this.refreshToken);
  }

  async status() {
    if (!this.configurado) return { configurado: false, conectado: false };
    try {
      const drive = await this.conectar();
      const raizId = await drive.garantirPasta(RAIZ, null);
      return { configurado: true, conectado: true, raiz: RAIZ, raizLink: drive.linkPasta(raizId) };
    } catch (e) {
      return { configurado: true, conectado: false, erro: e instanceof Error ? e.message : 'falha' };
    }
  }

  // Cria (ou reusa) a pasta do MEI dentro da raiz AtendeMEI e grava o id.
  async criarPastaMei(tenantId: string, usuarioId: string, clienteId: string) {
    if (!this.configurado) {
      throw new NotFoundException('Google Drive não configurado.');
    }
    const cliente = await this.prisma.cliente.findFirst({ where: { id: clienteId, tenantId } });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');

    const drive = await this.conectar();
    const raizId = await drive.garantirPasta(RAIZ, null);

    const nome = this.nomePasta(cliente);
    const folderId = await drive.garantirPasta(nome, raizId);

    await this.prisma.cliente.update({
      where: { id: clienteId },
      data: { driveFolderId: folderId },
    });
    await this.audit.log({
      tenantId,
      usuarioId,
      acao: 'drive.pasta.criar',
      entidade: 'Cliente',
      entidadeId: clienteId,
    });

    return { folderId, link: drive.linkPasta(folderId), nome };
  }

  private nomePasta(cliente: { razaoSocial: string | null; nomeFantasia: string | null; cnpj: string | null }) {
    const base = cliente.razaoSocial ?? cliente.nomeFantasia ?? cliente.cnpj ?? 'MEI';
    const cnpj = cliente.cnpj ? ` (${cliente.cnpj})` : '';
    return `${base}${cnpj}`.replace(/[\\/]/g, '-').slice(0, 120);
  }
}
