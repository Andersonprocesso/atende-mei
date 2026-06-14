import { FormEvent, useState } from 'react';
import { api, Cliente } from '../lib/api';

export function NovoClienteModal({
  onFechar,
  onCriado,
}: {
  onFechar: () => void;
  onCriado: () => void;
}) {
  const [form, setForm] = useState({
    cnpj: '',
    nomeFantasia: '',
    nomeContato: '',
    telefoneWa: '',
    email: '',
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function set(campo: keyof typeof form, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await api.post<Cliente>('/clientes', {
        cnpj: form.cnpj.replace(/\D/g, ''),
        nomeFantasia: form.nomeFantasia || undefined,
        nomeContato: form.nomeContato || undefined,
        telefoneWa: form.telefoneWa,
        email: form.email || undefined,
      });
      onCriado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={onSubmit}
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg"
      >
        <h2 className="text-lg font-bold mb-4">Novo MEI</h2>

        <Campo label="CNPJ (14 dígitos)">
          <input
            value={form.cnpj}
            onChange={(e) => set('cnpj', e.target.value)}
            placeholder="00000000000000"
            className="input"
            required
          />
        </Campo>
        <Campo label="Nome fantasia">
          <input
            value={form.nomeFantasia}
            onChange={(e) => set('nomeFantasia', e.target.value)}
            className="input"
          />
        </Campo>
        <Campo label="Nome do contato">
          <input
            value={form.nomeContato}
            onChange={(e) => set('nomeContato', e.target.value)}
            className="input"
          />
        </Campo>
        <Campo label="WhatsApp (E.164, ex.: +5511999999999)">
          <input
            value={form.telefoneWa}
            onChange={(e) => set('telefoneWa', e.target.value)}
            placeholder="+5511999999999"
            className="input"
            required
          />
        </Campo>
        <Campo label="E-mail">
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className="input"
          />
        </Campo>

        {erro && <div className="text-red-600 text-sm mb-3">{erro}</div>}

        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="px-4 py-2 text-sm rounded-lg bg-brand text-white disabled:opacity-60"
          >
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
