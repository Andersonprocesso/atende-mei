import { ConversationStateMachine } from './conversation-state-machine';
import { Estados } from './conversation.states';
import { AIAssistant, Intencao } from '../ai/ai-assistant.interface';

// Fluxos críticos do bot: onboarding, slot-filling da NFS-e e handoff.
describe('ConversationStateMachine', () => {
  const cliente = { id: 'c1', cnpj: '98765432000111', nomeContato: 'João' };

  function comAI(parcial: Partial<AIAssistant>): ConversationStateMachine {
    const ai: AIAssistant = {
      detectarIntencao: async () => ({ intencao: Intencao.CONSULTOR, confianca: 0.4 }),
      responderConsultor: async () => 'resposta consultor',
      ...parcial,
    };
    return new ConversationStateMachine(ai);
  }

  it('pede CNPJ no onboarding quando o cliente não tem CNPJ', async () => {
    const sm = comAI({});
    const r = await sm.processar({
      texto: 'oi',
      estado: null,
      contexto: {},
      cliente: { id: 'c2', cnpj: null, nomeContato: null },
    });
    expect(r.novoEstado).toBe(Estados.ONBOARDING_CNPJ);
    expect(r.respostas[0]).toMatch(/CNPJ/i);
  });

  it('conclui onboarding com CNPJ válido e atualiza o cadastro', async () => {
    const sm = comAI({});
    const r = await sm.processar({
      texto: '98.765.432/0001-11',
      estado: Estados.ONBOARDING_CNPJ,
      contexto: {},
      cliente: { id: 'c2', cnpj: null, nomeContato: null },
    });
    expect(r.atualizarCliente?.cnpj).toBe('98765432000111');
    expect(r.novoEstado).toBeNull();
  });

  it('inicia o fluxo de NFS-e ao detectar a intenção', async () => {
    const sm = comAI({
      detectarIntencao: async () => ({
        intencao: Intencao.EMITIR_NFSE,
        confianca: 0.9,
      }),
    });
    const r = await sm.processar({
      texto: 'quero emitir uma nota',
      estado: null,
      contexto: {},
      cliente,
    });
    expect(r.novoEstado).toBe(Estados.NFSE_TOMADOR);
  });

  it('coleta os slots e dispara a ação de emissão ao confirmar', async () => {
    const sm = comAI({});

    const r1 = await sm.processar({
      texto: 'Maria Souza',
      estado: Estados.NFSE_TOMADOR,
      contexto: { nfse: {} },
      cliente,
    });
    expect(r1.novoEstado).toBe(Estados.NFSE_DESCRICAO);

    const r2 = await sm.processar({
      texto: 'Consultoria de marketing',
      estado: Estados.NFSE_DESCRICAO,
      contexto: r1.novoContexto,
      cliente,
    });
    expect(r2.novoEstado).toBe(Estados.NFSE_VALOR);

    const r3 = await sm.processar({
      texto: '150,00',
      estado: Estados.NFSE_VALOR,
      contexto: r2.novoContexto,
      cliente,
    });
    expect(r3.novoEstado).toBe(Estados.NFSE_CONFIRMAR);

    const r4 = await sm.processar({
      texto: 'sim',
      estado: Estados.NFSE_CONFIRMAR,
      contexto: r3.novoContexto,
      cliente,
    });
    expect(r4.acaoPendente?.tipo).toBe('EMITIR_NFSE');
    expect(r4.acaoPendente?.dados).toMatchObject({
      tomadorNome: 'Maria Souza',
      descricao: 'Consultoria de marketing',
      valor: 150,
    });
    expect(r4.novoEstado).toBeNull();
  });

  it('sinaliza handoff ao pedir atendente humano', async () => {
    const sm = comAI({
      detectarIntencao: async () => ({
        intencao: Intencao.FALAR_HUMANO,
        confianca: 0.9,
      }),
    });
    const r = await sm.processar({
      texto: 'quero falar com um atendente',
      estado: null,
      contexto: {},
      cliente,
    });
    expect(r.handoff).toBe(true);
  });
});
