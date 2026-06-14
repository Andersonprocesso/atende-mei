import { useEffect, useState } from 'react';
import { api, Paginated, Cliente } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Dashboard() {
  const { usuario } = useAuth();
  const [totalMeis, setTotalMeis] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<Paginated<Cliente>>('/clientes?pageSize=1')
      .then((r) => setTotalMeis(r.total))
      .catch(() => setTotalMeis(null));
  }, []);

  const cards = [
    { label: 'MEIs cadastrados', valor: totalMeis ?? '—' },
    { label: 'MRR', valor: '—' },
    { label: 'Emissões no mês', valor: '—' },
    { label: 'Vencimentos próximos', valor: '—' },
  ];

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Olá, {usuario?.nome}</h1>
        <p className="text-slate-500">Visão geral da contabilidade.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-sm text-slate-500">{c.label}</div>
            <div className="text-2xl font-bold mt-1">{c.valor}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-6">
        Métricas de MRR, emissões e vencimentos são preenchidas na etapa 6.
      </p>
    </div>
  );
}
