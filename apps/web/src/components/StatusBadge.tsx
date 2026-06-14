import { SituacaoFiscal } from '../lib/api';

const cores: Record<SituacaoFiscal, string> = {
  REGULAR: 'bg-green-100 text-green-800',
  PENDENTE: 'bg-amber-100 text-amber-800',
  IRREGULAR: 'bg-red-100 text-red-800',
  DESCONHECIDA: 'bg-slate-100 text-slate-600',
};

export function StatusBadge({ situacao }: { situacao: SituacaoFiscal }) {
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${cores[situacao]}`}>
      {situacao.toLowerCase()}
    </span>
  );
}
