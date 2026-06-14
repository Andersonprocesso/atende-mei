import { Injectable } from '@nestjs/common';
import {
  AIAssistant,
  DeteccaoIntencao,
  Intencao,
} from './ai-assistant.interface';

// Roteamento de intenções por palavras-chave (sem LLM). Determinístico,
// suficiente para desenvolver a máquina de estados localmente.
@Injectable()
export class MockAIProvider implements AIAssistant {
  async detectarIntencao(texto: string): Promise<DeteccaoIntencao> {
    const t = texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, ''); // remove acentos

    const match = (palavras: string[]) => palavras.some((p) => t.includes(p));

    if (match(['atendente', 'humano', 'pessoa', 'falar com', 'contador'])) {
      return { intencao: Intencao.FALAR_HUMANO, confianca: 0.9 };
    }
    if (match(['nota', 'nfse', 'nfs-e', 'nfe', 'emitir nota'])) {
      const slots = this.extrairValor(t);
      return { intencao: Intencao.EMITIR_NFSE, confianca: 0.85, slots };
    }
    if (match(['das', 'guia', 'imposto', 'boleto', 'darf'])) {
      return { intencao: Intencao.EMITIR_DAS, confianca: 0.85 };
    }
    if (match(['venc', 'quando', 'prazo', 'vencimento', 'dia 20'])) {
      return { intencao: Intencao.CONSULTAR_VENCIMENTO, confianca: 0.8 };
    }
    if (match(['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'menu', 'inicio'])) {
      return { intencao: Intencao.SAUDACAO, confianca: 0.7 };
    }
    // qualquer outra coisa é tratada como dúvida ao consultor
    return { intencao: Intencao.CONSULTOR, confianca: 0.4 };
  }

  async responderConsultor(pergunta: string): Promise<string> {
    // Mock: resposta canônica. O adapter real chamaria o LLM com contexto do MEI.
    return (
      `Sou o consultor do Atende MEI 🤖. Sobre "${pergunta.slice(0, 80)}": ` +
      `como MEI, suas principais obrigações são pagar o DAS todo mês (vence dia 20) ` +
      `e entregar a DASN-SIMEI até 31 de maio. Posso emitir uma nota ou a guia DAS para você — ` +
      `é só pedir. (Resposta simulada — conecte um LLM em AI_PROVIDER.)`
    );
  }

  // extrai um valor monetário simples, ex.: "emitir nota de 150,50"
  private extrairValor(texto: string): Record<string, unknown> | undefined {
    const m = texto.match(/(\d+[.,]?\d{0,2})/);
    if (!m) return undefined;
    const valor = parseFloat(m[1].replace('.', '').replace(',', '.'));
    return Number.isFinite(valor) ? { valor } : undefined;
  }
}
