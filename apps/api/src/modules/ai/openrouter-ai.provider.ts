import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AIAssistant,
  DeteccaoIntencao,
} from './ai-assistant.interface';
import { MockAIProvider } from './mock-ai.provider';
import { MemoriaService } from '../memoria/memoria.service';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Consultor do MEI via LLM (OpenRouter/DeepSeek) com memória (RAG).
// O roteamento de intenção (emitir nota/DAS, etc.) continua determinístico
// (delegado ao MockAIProvider) para não arriscar os fluxos fiscais.
@Injectable()
export class OpenRouterAIProvider implements AIAssistant {
  private readonly logger = new Logger('OpenRouterAI');
  private readonly url: string;
  private readonly key: string;
  private readonly model: string;

  constructor(
    config: ConfigService,
    private readonly intent: MockAIProvider,
    private readonly memoria: MemoriaService,
  ) {
    const base = (config.get<string>('AI_BASE_URL') ?? '').trim();
    this.url = base
      ? /\/chat\/completions\/?$/.test(base)
        ? base
        : `${base.replace(/\/$/, '')}/chat/completions`
      : OPENROUTER_URL;
    this.key = config.get<string>('AI_API_KEY') ?? '';
    this.model = config.get<string>('AI_MODEL') ?? 'deepseek/deepseek-chat';
  }

  detectarIntencao(texto: string): Promise<DeteccaoIntencao> {
    return this.intent.detectarIntencao(texto);
  }

  async responderConsultor(
    pergunta: string,
    contexto?: Record<string, unknown>,
  ): Promise<string> {
    const tenantId = (contexto?.tenantId as string) ?? 'default';

    if (this.url === OPENROUTER_URL && !this.key) {
      // sem chave configurada — cai no mock para não quebrar a conversa
      return this.intent.responderConsultor(pergunta);
    }

    // RAG: injeta respostas anteriores parecidas (aprendizado)
    let memBlock = '';
    try {
      const mems = await this.memoria.buscar(tenantId, pergunta);
      if (mems.length) {
        memBlock =
          '\n\n--- ATENDIMENTOS ANTERIORES PARECIDOS (use como referência) ---\n' +
          mems
            .map((m, i) => `${i + 1}. P: ${m.pergunta}\n   R: ${m.resposta}`)
            .join('\n') +
          '\n--- FIM ---';
      }
    } catch {
      /* memória é best-effort */
    }

    const system =
      'Você é o consultor virtual do Atende MEI, especialista em Microempreendedor ' +
      'Individual (MEI) no Brasil. Responda SEMPRE em português, de forma cordial, ' +
      'curta e objetiva (máximo 3-4 frases). Foque em obrigações do MEI: DAS mensal ' +
      '(vence dia 20), DASN-SIMEI (até 31/maio), emissão de notas, limites de ' +
      'faturamento e regularização. Você pode emitir nota fiscal e a guia DAS aqui ' +
      'mesmo — convide o usuário a pedir. NÃO invente valores ou prazos.' +
      memBlock;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.key) headers.Authorization = `Bearer ${this.key}`;
      if (this.url === OPENROUTER_URL) {
        headers['HTTP-Referer'] = 'https://atendemei.escondigital.com.br';
        headers['X-Title'] = 'Atende MEI';
      }

      const res = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: pergunta },
          ],
          temperature: 0.6,
          max_tokens: 400,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
      }
      const data: any = await res.json();
      const resposta: string =
        data?.choices?.[0]?.message?.content?.trim() ||
        'Desculpe, não consegui responder agora. Pode reformular?';

      // aprende com a interação
      this.memoria.aprender(tenantId, pergunta, resposta).catch(() => undefined);
      return resposta;
    } catch (e) {
      this.logger.error(`responderConsultor erro: ${e instanceof Error ? e.message : e}`);
      return this.intent.responderConsultor(pergunta);
    }
  }
}
