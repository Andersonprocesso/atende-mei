import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Cliente, Paginated, SituacaoFiscal } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { NovoClienteModal } from '../components/NovoClienteModal';

const SITUACOES: (SituacaoFiscal | '')[] = [
  '',
  'REGULAR',
  'PENDENTE',
  'IRREGULAR',
  'DESCONHECIDA',
];

export default function Clientes() {
  const [q, setQ] = useState('');
  const [situacao, setSituacao] = useState<SituacaoFiscal | ''>('');
  const [page, setPage] = useState(1);
  const [resultado, setResultado] = useState<Paginated<Cliente> | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

  async function carregar() {
    setCarregando(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (situacao) params.set('situacaoFiscal', situacao);
    params.set('page', String(page));
    try {
      const res = await api.get<Paginated<Cliente>>(`/clientes?${params}`);
      setResultado(res);
    } finally {
      setCarregando(false);
    }
  }

  // recarrega quando filtros/página mudam (debounce simples na busca)
  useEffect(() => {
    const t = setTimeout(carregar, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, situacao, page]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Carteira de MEIs</h1>
          <p className="text-slate-500">
            {resultado ? `${resultado.total} cliente(s)` : 'Carregando…'}
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="bg-brand hover:bg-brand-dark text-white rounded-lg px-4 py-2 text-sm font-medium"
        >
          + Novo MEI
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          placeholder="Buscar por nome, CNPJ ou telefone…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <select
          value={situacao}
          onChange={(e) => {
            setPage(1);
            setSituacao(e.target.value as SituacaoFiscal | '');
          }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          {SITUACOES.map((s) => (
            <option key={s} value={s}>
              {s === '' ? 'Todas as situações' : s.toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nome / Razão</th>
              <th className="px-4 py-3 font-medium">CNPJ</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Situação fiscal</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {resultado?.data.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {c.nomeFantasia ?? c.razaoSocial ?? '—'}
                  </div>
                  <div className="text-slate-400 text-xs">{c.nomeContato}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{c.cnpj}</td>
                <td className="px-4 py-3">{c.telefoneWa}</td>
                <td className="px-4 py-3">
                  <StatusBadge situacao={c.situacaoFiscal} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/clientes/${c.id}`} className="text-brand hover:underline">
                    Abrir ficha
                  </Link>
                </td>
              </tr>
            ))}
            {!carregando && resultado?.data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {resultado && resultado.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border rounded-md disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-slate-500">
            {page} / {resultado.totalPages}
          </span>
          <button
            disabled={page >= resultado.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded-md disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}

      {modalAberto && (
        <NovoClienteModal
          onFechar={() => setModalAberto(false)}
          onCriado={() => {
            setModalAberto(false);
            carregar();
          }}
        />
      )}
    </div>
  );
}
