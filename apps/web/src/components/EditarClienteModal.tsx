import { FormEvent, useState } from 'react';
import { api, Cliente, SituacaoFiscal } from '../lib/api';

const SITUACOES: SituacaoFiscal[] = ['REGULAR', 'PENDENTE', 'IRREGULAR', 'DESCONHECIDA'];

export function EditarClienteModal({
  cliente,
  onFechar,
  onSalvo,
}: {
  cliente: Cliente;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState({
    razaoSocial: cliente.razaoSocial ?? '',
    nomeFantasia: cliente.nomeFantasia ?? '',
    nomeContato: cliente.nomeContato ?? '',
    telefoneWa: cliente.telefoneWa ?? '',
    email: cliente.email ?? '',
    situacaoFiscal: cliente.situacaoFiscal,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await api.patch(`/clientes/${cliente.id}`, {
        razaoSocial: form.razaoSocial || undefined,
        nomeFantasia: form.nomeFantasia || undefined,
        nomeContato: form.nomeContato || undefined,
        telefoneWa: form.telefoneWa || undefined,
        email: form.email || undefined,
        situacaoFiscal: form.situacaoFiscal,
      });
      onSalvo();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={onSubmit} className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg">
        <h2 className="text-lg font-bold mb-4">Editar MEI</h2>

        <Campo label="Razão social">
          <input className="input" value={form.razaoSocial} onChange={(e) => set('razaoSocial', e.target.value)} />
        </Campo>
        <Campo label="Nome fantasia">
          <input className="input" value={form.nomeFantasia} onChange={(e) => set('nomeFantasia', e.target.value)} />
        </Campo>
        <Campo label="Contato">
          <input className="input" value={form.nomeContato} onChange={(e) => set('nomeContato', e.target.value)} />
        </Campo>
        <Campo label="WhatsApp (E.164)">
          <input className="input" value={form.telefoneWa} onChange={(e) => set('telefoneWa', e.target.value)} placeholder="+5511999999999" />
        </Campo>
        <Campo label="E-mail">
          <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Campo>
        <Campo label="Situação fiscal">
          <select className="input" value={form.situacaoFiscal} onChange={(e) => set('situacaoFiscal', e.target.value)}>
            {SITUACOES.map((s) => (
              <option key={s} value={s}>{s.toLowerCase()}</option>
            ))}
          </select>
        </Campo>

        {erro && <div className="text-red-600 text-sm mb-3">{erro}</div>}
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" onClick={onFechar} className="px-4 py-2 text-sm rounded-lg border border-slate-300">
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className="px-4 py-2 text-sm rounded-lg bg-brand text-white disabled:opacity-60">
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}
