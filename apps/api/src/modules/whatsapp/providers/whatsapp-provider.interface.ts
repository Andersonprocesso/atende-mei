// Abstração do canal WhatsApp. A máquina de estados só conhece esta interface.
// Implementações: MockWhatsappProvider (etapa 3) | WhatsApp Cloud API (Meta).

export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');

export interface MensagemEnviada {
  // id da mensagem no provedor (usado como externalId para idempotência)
  externalId: string;
}

export interface AnexoSaida {
  tipo: 'document' | 'image';
  url: string;
  caption?: string;
}

export interface WhatsappProvider {
  // envia texto simples
  enviarTexto(para: string, texto: string): Promise<MensagemEnviada>;

  // envia documento (ex.: PDF da NFS-e ou da guia DAS)
  enviarDocumento(para: string, anexo: AnexoSaida): Promise<MensagemEnviada>;
}
