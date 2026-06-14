import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Paginated, Cliente } from '../lib/api';
import { useAuth } from '../lib/auth';

interface CertVencendo {
  id: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  certificadoValidade: string | null;
  diasRestantes: number | null;
}
interface AlertaLimite {
  clienteId: string;
  total: number;
  percentual: number;
  status: string;
  cliente: { razaoSocial: string | null; nomeFantasia: string | null } | null;
}

export default function Dashboard() {
  const { usuario } = useAuth();
  const [totalMeis, setTotalMeis] = useState<number | null>(null);
  const [certs, setCerts] = useState<CertVencendo[]>([]);
  const [limites, setLimites] = useState<AlertaLimite[]>([]);

  useEffect(() => {
    api.get<Paginated<Cliente>>('/clientes?pageSize=1').then((r) => setTotalMeis(r.total)).catch(() => {});
    api.get<CertVencendo[]>('/clientes/certificados/vencendo?dias=45').then(setCerts).catch(() => {});
    api.get<AlertaLimite[]>('/faturamento/alertas').then(setLimites).catch(() => {});
  }, []);

  const nome = (c: { razaoSocial: string | null; nomeFantasia: string | null } | null) =>
    c?.nomeFantasia ?? c?.razaoSocial ?? '—';
  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Olá, {usuario?.nome}</h1>
        <p className="text-slate-500">Visão geral da contabilidade.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'MEIs cadastrados', valor: totalMeis ?? '—' },
          { label: 'Certificados vencendo', valor: certs.length },
          { label: 'MEIs perto do limite', valor: limites.length },
          { label: 'Vencimentos próximos', valor: '—' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-sm text-slate-500">{c.label}</div>
            <div className="text-2xl font-bold mt-1">{c.valor}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* certificados vencendo */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold mb-3">🔐 Certificados vencendo (45 dias)</h2>
          {certs.length === 0 ? (
            <p className="text-slate-400 text-sm">Nenhum certificado vencendo. 👍</p>
          ) : (
            <ul className="text-sm divide-y divide-slate-100">
              {certs.map((c) => (
                <li key={c.id} className="py-2 flex justify-between items-center">
                  <Link to={`/clientes/${c.id}`} className="text-brand hover:underline">
                    {nome(c)}
                  </Link>
                  <span className={(c.diasRestantes ?? 0) < 0 ? 'text-red-600' : 'text-amber-600'}>
                    {c.diasRestantes != null
                      ? c.diasRestantes < 0
                        ? `vencido há ${-c.diasRestantes}d`
                        : `${c.diasRestantes}d`
                      : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* limite do MEI */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold mb-3">📈 MEIs perto do limite</h2>
          {limites.length === 0 ? (
            <p className="text-slate-400 text-sm">Ninguém acima de 80% do limite. 👍</p>
          ) : (
            <ul className="text-sm divide-y divide-slate-100">
              {limites.map((l) => (
                <li key={l.clienteId} className="py-2 flex justify-between items-center">
                  <Link to={`/clientes/${l.clienteId}`} className="text-brand hover:underline">
                    {nome(l.cliente)}
                  </Link>
                  <span className={l.status === 'ESTOURADO' ? 'text-red-600' : 'text-orange-600'}>
                    {l.percentual}% · R$ {fmt(l.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
