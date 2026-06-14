import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AnexoSaida,
  MensagemEnviada,
  WhatsappProvider,
} from './whatsapp-provider.interface';

export interface OutboxItem {
  id: string;
  para: string;
  tipo: 'texto' | 'documento';
  conteudo: string;
  anexo?: AnexoSaida;
  enviadoEm: string;
}

// Provider de desenvolvimento: não chama a Meta. Loga e guarda numa "outbox"
// em memória que pode ser inspecionada por GET /api/whatsapp/outbox.
@Injectable()
export class MockWhatsappProvider implements WhatsappProvider {
  private readonly logger = new Logger('MockWhatsapp');
  private readonly outbox: OutboxItem[] = [];

  async enviarTexto(para: string, texto: string): Promise<MensagemEnviada> {
    const id = `mock-${randomUUID()}`;
    this.outbox.push({
      id,
      para,
      tipo: 'texto',
      conteudo: texto,
      enviadoEm: new Date().toISOString(),
    });
    this.logger.log(`→ ${para}: ${texto}`);
    return { externalId: id };
  }

  async enviarDocumento(
    para: string,
    anexo: AnexoSaida,
  ): Promise<MensagemEnviada> {
    const id = `mock-${randomUUID()}`;
    this.outbox.push({
      id,
      para,
      tipo: 'documento',
      conteudo: anexo.caption ?? anexo.url,
      anexo,
      enviadoEm: new Date().toISOString(),
    });
    this.logger.log(`→ ${para}: [doc] ${anexo.url}`);
    return { externalId: id };
  }

  // helpers de inspeção (dev)
  listarOutbox(para?: string): OutboxItem[] {
    const items = para ? this.outbox.filter((o) => o.para === para) : this.outbox;
    return [...items].reverse();
  }

  limparOutbox() {
    this.outbox.length = 0;
  }
}
