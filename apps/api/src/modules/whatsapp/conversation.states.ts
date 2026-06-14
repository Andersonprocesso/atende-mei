// Estados persistidos em Conversa.estado. `null` = ocioso (roteia intenção).
export const Estados = {
  ONBOARDING_CNPJ: 'onboarding:cnpj',
  NFSE_TOMADOR: 'nfse:tomador',
  NFSE_DESCRICAO: 'nfse:descricao',
  NFSE_VALOR: 'nfse:valor',
  NFSE_CONFIRMAR: 'nfse:confirmar',
  DAS_CONFIRMAR: 'das:confirmar',
} as const;

export type Estado = (typeof Estados)[keyof typeof Estados] | null;

// Ação de negócio que a conversa disparou e que será executada pelas
// etapas seguintes (emissão real de NFS-e/DAS — etapa 4).
export interface AcaoPendente {
  tipo: 'EMITIR_NFSE' | 'EMITIR_DAS';
  dados: Record<string, unknown>;
}

export interface ResultadoConversa {
  respostas: string[]; // textos a enviar ao MEI
  novoEstado: Estado;
  novoContexto: Record<string, unknown>;
  handoff?: boolean; // transferir para atendente humano
  atualizarCliente?: { cnpj?: string }; // mudanças no cadastro (onboarding)
  acaoPendente?: AcaoPendente;
}

export const MENU = [
  'Como posso ajudar? 👇',
  '1️⃣ Emitir *nota fiscal* (NFS-e)',
  '2️⃣ Emitir *guia DAS*',
  '3️⃣ Consultar *vencimento*',
  '4️⃣ Tirar uma *dúvida*',
  '5️⃣ Falar com um *atendente*',
  '',
  'É só escrever o que precisa. (digite *menu* a qualquer momento)',
].join('\n');
