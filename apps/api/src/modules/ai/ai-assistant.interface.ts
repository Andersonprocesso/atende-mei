// Abstração da IA conversacional. A máquina de estados usa estas duas
// operações: detectar a intenção da mensagem e gerar a resposta do consultor.
// Implementações: MockAIProvider (etapa 3) | LLM real (OpenAI/Anthropic).

export const AI_ASSISTANT = Symbol('AI_ASSISTANT');

export enum Intencao {
  SAUDACAO = 'SAUDACAO',
  EMITIR_NFSE = 'EMITIR_NFSE',
  EMITIR_DAS = 'EMITIR_DAS',
  CONSULTAR_VENCIMENTO = 'CONSULTAR_VENCIMENTO',
  CONSULTOR = 'CONSULTOR', // dúvida geral sobre obrigações do MEI
  FALAR_HUMANO = 'FALAR_HUMANO',
  DESCONHECIDO = 'DESCONHECIDO',
}

export interface DeteccaoIntencao {
  intencao: Intencao;
  // confiança 0..1 (mock usa heurística)
  confianca: number;
  // slots extraídos quando possível (ex.: { valor: 150.0 })
  slots?: Record<string, unknown>;
}

export interface AIAssistant {
  detectarIntencao(
    texto: string,
    contexto?: Record<string, unknown>,
  ): Promise<DeteccaoIntencao>;

  // Resposta do "consultor de negócios" para uma dúvida do MEI.
  responderConsultor(
    pergunta: string,
    contexto?: Record<string, unknown>,
  ): Promise<string>;
}
