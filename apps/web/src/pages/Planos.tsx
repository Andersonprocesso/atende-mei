import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Plano {
  id: string;
  tier: 'GRATIS' | 'MEI_PLUS' | 'MEI_PLUS_PLUS';
  nome: string;
  precoMensal: string;
}

// Recursos por plano (modelo MEItor).
const RECURSOS: Record<Plano['tier'], { destaque?: boolean; itens: string[] }> = {
  GRATIS: {
    itens: [
      'Consultas limitadas ao consultor',
      'Emissão de notas limitada',
      'Lembretes básicos do DAS',
    ],
  },
  MEI_PLUS: {
    destaque: true,
    itens: [
      'Consultas *ilimitadas* ao consultor IA',
      'Emissão de notas (limite mensal)',
      'DAS automático + lembretes',
      'Certificado digital incluso',
    ],
  },
  MEI_PLUS_PLUS: {
    itens: [
      'Consultas *ilimitadas*',
      'Emissão de notas *ilimitada*',
      'Regularização fiscal',
      'Controle de limite e DASN',
      'Certificado digital incluso',
    ],
  },
};

export default function Planos() {
  const [planos, setPlanos] = useState<Plano[]>([]);

  useEffect(() => {
    api.get<Plano[]>('/planos').then(setPlanos).catch(() => {});
  }, []);

  const fmt = (v: string) =>
    Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Planos & Mensalidades</h1>
      <p className="text-slate-500 mb-6">
        Precificação do atendimento ao MEI (pagamento via PIX, boleto ou cartão em 12x).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {planos.map((p) => {
          const cfg = RECURSOS[p.tier];
          return (
            <div
              key={p.id}
              className={`rounded-2xl border p-6 bg-white ${
                cfg?.destaque ? 'border-brand ring-2 ring-brand/20' : 'border-slate-200'
              }`}
            >
              {cfg?.destaque && (
                <div className="text-xs font-semibold text-brand mb-2">MAIS POPULAR</div>
              )}
              <div className="text-lg font-bold">{p.nome}</div>
              <div className="mt-2 mb-4">
                <span className="text-3xl font-bold">
                  R$ {fmt(p.precoMensal)}
                </span>
                {Number(p.precoMensal) > 0 && <span className="text-slate-500">/mês</span>}
              </div>
              <ul className="space-y-2 text-sm">
                {cfg?.itens.map((it) => (
                  <li key={it} className="flex gap-2">
                    <span className="text-brand">✓</span>
                    <span dangerouslySetInnerHTML={{ __html: it.replace(/\*(.+?)\*/g, '<b>$1</b>') }} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {planos.length === 0 && (
        <p className="text-slate-400 mt-6">Nenhum plano cadastrado.</p>
      )}
    </div>
  );
}
