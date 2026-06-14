import { Inject, Injectable } from '@nestjs/common';
import {
  AI_ASSISTANT,
  AIAssistant,
  Intencao,
} from '../ai/ai-assistant.interface';
import {
  Estados,
  MENU,
  ResultadoConversa,
} from './conversation.states';

interface EntradaConversa {
  texto: string;
  estado: string | null;
  contexto: Record<string, unknown>;
  cliente: { id: string; cnpj: string | null; nomeContato: string | null };
}

// Lógica conversacional pura: recebe o estado atual + a mensagem e devolve
// as respostas e o próximo estado. Não toca no banco nem no provider —
// quem orquestra é o ConversationService.
@Injectable()
export class ConversationStateMachine {
  constructor(@Inject(AI_ASSISTANT) private readonly ai: AIAssistant) {}

  async processar(input: EntradaConversa): Promise<ResultadoConversa> {
    const { texto, estado, contexto, cliente } = input;
    const t = texto.trim();
    const tl = t.toLowerCase();

    // comando global de reset
    if (['menu', 'cancelar', 'sair', 'voltar'].includes(tl)) {
      return this.menu(contexto);
    }

    // onboarding tem prioridade: sem CNPJ, primeiro identificamos o MEI
    if (!cliente.cnpj && estado !== Estados.ONBOARDING_CNPJ) {
      return {
        respostas: [
          'Olá! 👋 Bem-vindo ao *Atende MEI*. Para começar, me informe o *CNPJ* do seu MEI (apenas os 14 números).',
        ],
        novoEstado: Estados.ONBOARDING_CNPJ,
        novoContexto: contexto,
      };
    }

    switch (estado) {
      case Estados.ONBOARDING_CNPJ:
        return this.onboarding(t, contexto);
      case Estados.NFSE_TOMADOR:
        return this.nfseTomador(t, contexto);
      case Estados.NFSE_DESCRICAO:
        return this.nfseDescricao(t, contexto);
      case Estados.NFSE_VALOR:
        return this.nfseValor(t, contexto);
      case Estados.NFSE_CONFIRMAR:
        return this.nfseConfirmar(tl, contexto);
      case Estados.DAS_CONFIRMAR:
        return this.dasConfirmar(tl, contexto);
      default:
        return this.rotearIntencao(t, contexto);
    }
  }

  // ───────── roteamento por intenção (estado ocioso) ─────────
  private async rotearIntencao(
    texto: string,
    contexto: Record<string, unknown>,
  ): Promise<ResultadoConversa> {
    const { intencao, slots } = await this.ai.detectarIntencao(texto);

    switch (intencao) {
      case Intencao.SAUDACAO:
        return this.menu(contexto);

      case Intencao.EMITIR_NFSE:
        return {
          respostas: [
            'Vamos emitir sua *nota fiscal* 🧾',
            'Para quem é a nota? Me diga o *nome do tomador* (cliente).',
          ],
          novoEstado: Estados.NFSE_TOMADOR,
          novoContexto: { ...contexto, nfse: slots ?? {} },
        };

      case Intencao.EMITIR_DAS: {
        const comp = competenciaAtual();
        return {
          respostas: [
            `Posso gerar a *guia DAS* da competência *${comp}* (vence dia 20). Confirma? (responda *sim*)`,
          ],
          novoEstado: Estados.DAS_CONFIRMAR,
          novoContexto: { ...contexto, das: { competencia: comp } },
        };
      }

      case Intencao.CONSULTAR_VENCIMENTO:
        return {
          respostas: [
            `📅 O *DAS-MEI* vence todo dia *20*. Próximo vencimento: *${proximoVencimento()}*.`,
            'A *DASN-SIMEI* (declaração anual) vai até *31 de maio*.',
          ],
          novoEstado: null,
          novoContexto: contexto,
        };

      case Intencao.FALAR_HUMANO:
        return {
          respostas: [
            '👩‍💼 Tudo bem! Estou transferindo você para um *atendente* da contabilidade. Já já alguém responde por aqui.',
          ],
          novoEstado: null,
          novoContexto: contexto,
          handoff: true,
        };

      case Intencao.CONSULTOR:
      default: {
        const resposta = await this.ai.responderConsultor(texto);
        return {
          respostas: [resposta, 'Posso ajudar em mais algo? (digite *menu*)'],
          novoEstado: null,
          novoContexto: contexto,
        };
      }
    }
  }

  // ───────── onboarding ─────────
  private onboarding(
    texto: string,
    contexto: Record<string, unknown>,
  ): ResultadoConversa {
    const cnpj = texto.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      return {
        respostas: ['Hmm, o CNPJ precisa ter *14 números*. Pode reenviar?'],
        novoEstado: Estados.ONBOARDING_CNPJ,
        novoContexto: contexto,
      };
    }
    return {
      respostas: [
        'Prontinho, cadastro confirmado! ✅',
        MENU,
      ],
      novoEstado: null,
      novoContexto: contexto,
      atualizarCliente: { cnpj },
    };
  }

  // ───────── fluxo NFS-e (slot filling) ─────────
  private nfseTomador(
    texto: string,
    contexto: Record<string, unknown>,
  ): ResultadoConversa {
    const nfse = { ...(contexto.nfse as object), tomadorNome: texto };
    return {
      respostas: ['Qual a *descrição do serviço* prestado?'],
      novoEstado: Estados.NFSE_DESCRICAO,
      novoContexto: { ...contexto, nfse },
    };
  }

  private nfseDescricao(
    texto: string,
    contexto: Record<string, unknown>,
  ): ResultadoConversa {
    const nfse = { ...(contexto.nfse as object), descricao: texto };
    return {
      respostas: ['Qual o *valor* do serviço? (ex.: 150,00)'],
      novoEstado: Estados.NFSE_VALOR,
      novoContexto: { ...contexto, nfse },
    };
  }

  private nfseValor(
    texto: string,
    contexto: Record<string, unknown>,
  ): ResultadoConversa {
    const valor = parseValor(texto);
    if (valor === null) {
      return {
        respostas: ['Não entendi o valor. Envie só o número, ex.: *150,00*'],
        novoEstado: Estados.NFSE_VALOR,
        novoContexto: contexto,
      };
    }
    const nfse = {
      ...(contexto.nfse as Record<string, unknown>),
      valor,
    } as { tomadorNome?: string; descricao?: string; valor: number };
    return {
      respostas: [
        [
          '📋 Confira os dados da nota:',
          `• Tomador: *${nfse.tomadorNome}*`,
          `• Serviço: *${nfse.descricao}*`,
          `• Valor: *R$ ${valor.toFixed(2)}*`,
          '',
          'Posso *emitir*? (responda *sim* ou *não*)',
        ].join('\n'),
      ],
      novoEstado: Estados.NFSE_CONFIRMAR,
      novoContexto: { ...contexto, nfse },
    };
  }

  private nfseConfirmar(
    tl: string,
    contexto: Record<string, unknown>,
  ): ResultadoConversa {
    if (['sim', 's', 'confirmar', 'pode', 'ok'].includes(tl)) {
      return {
        respostas: [
          '🧾 Emitindo sua nota fiscal... você receberá o PDF em instantes.',
        ],
        novoEstado: null,
        novoContexto: { ...contexto, nfse: undefined },
        acaoPendente: {
          tipo: 'EMITIR_NFSE',
          dados: contexto.nfse as Record<string, unknown>,
        },
      };
    }
    return {
      respostas: ['Sem problema, *cancelei* a emissão. (digite *menu*)'],
      novoEstado: null,
      novoContexto: { ...contexto, nfse: undefined },
    };
  }

  // ───────── fluxo DAS ─────────
  private dasConfirmar(
    tl: string,
    contexto: Record<string, unknown>,
  ): ResultadoConversa {
    if (['sim', 's', 'confirmar', 'pode', 'ok'].includes(tl)) {
      return {
        respostas: ['📑 Gerando sua guia DAS... você receberá o PDF e a linha digitável.'],
        novoEstado: null,
        novoContexto: { ...contexto, das: undefined },
        acaoPendente: {
          tipo: 'EMITIR_DAS',
          dados: contexto.das as Record<string, unknown>,
        },
      };
    }
    return {
      respostas: ['Ok, não vou gerar a guia agora. (digite *menu*)'],
      novoEstado: null,
      novoContexto: { ...contexto, das: undefined },
    };
  }

  private menu(contexto: Record<string, unknown>): ResultadoConversa {
    return { respostas: [MENU], novoEstado: null, novoContexto: contexto };
  }
}

// ───────── helpers ─────────
function parseValor(texto: string): number | null {
  const m = texto.match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  const v = parseFloat(m[1].replace('.', '').replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : null;
}

function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function proximoVencimento(): string {
  const hoje = new Date();
  let ano = hoje.getFullYear();
  let mes = hoje.getMonth();
  if (hoje.getDate() > 20) mes += 1;
  const venc = new Date(ano, mes, 20);
  return venc.toLocaleDateString('pt-BR');
}
