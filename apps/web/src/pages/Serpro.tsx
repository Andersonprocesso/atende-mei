import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';

interface StatusCred {
  temConsumerKey: boolean;
  temCertificado: boolean;
  temSenha: boolean;
  certFingerprint: string | null;
  contratanteCnpj: string | null;
  autorCnpj: string | null;
  atualizadoEm: string | null;
}

export default function Serpro() {
  const [status, setStatus] = useState<StatusCred | null>(null);
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [pfxBase64, setPfxBase64] = useState('');
  const [pfxNome, setPfxNome] = useState('');
  const [senhaPfx, setSenhaPfx] = useState('');
  const [contratanteCnpj, setContratante] = useState('09377184000188');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [conexao, setConexao] = useState<string | null>(null);

  function carregar() {
    api.get<StatusCred>('/serpro/credenciais').then(setStatus).catch(() => {});
  }
  useEffect(carregar, []);

  function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPfxNome(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = String(reader.result).split(',')[1] ?? '';
      setPfxBase64(b64);
    };
    reader.readAsDataURL(f);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMsg(null);
    try {
      const body: Record<string, string> = { contratanteCnpj, autorCnpj: contratanteCnpj };
      if (consumerKey) body.consumerKey = consumerKey;
      if (consumerSecret) body.consumerSecret = consumerSecret;
      if (pfxBase64) body.pfxBase64 = pfxBase64;
      if (senhaPfx) body.senhaPfx = senhaPfx;
      await api.put('/serpro/credenciais', body);
      setMsg('Credenciais salvas com segurança ✅');
      setConsumerKey('');
      setConsumerSecret('');
      setSenhaPfx('');
      setPfxBase64('');
      setPfxNome('');
      carregar();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function testar() {
    setConexao('testando…');
    try {
      const r = await api.get<{ conectado: boolean; erro?: string }>('/serpro/status');
      setConexao(r.conectado ? 'Conectado ao SERPRO ✅' : `Falhou: ${r.erro ?? '—'}`);
    } catch (e) {
      setConexao(e instanceof Error ? e.message : 'Falha');
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">SERPRO — Integra Contador</h1>
      <p className="text-slate-500 mb-6">
        Credenciais e certificado da Dias de Paula para emissão de DAS-MEI. Guardados
        cifrados; nunca são exibidos de volta.
      </p>

      {/* status atual */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h2 className="font-semibold mb-3">Status</h2>
        {!status ? (
          <p className="text-slate-400 text-sm">Carregando…</p>
        ) : (
          <ul className="text-sm space-y-1">
            <li>Consumer Key/Secret: {status.temConsumerKey ? '✅ cadastrada' : '— ausente'}</li>
            <li>Certificado .pfx: {status.temCertificado ? '✅ cadastrado' : '— ausente'}</li>
            <li>Senha do certificado: {status.temSenha ? '✅' : '—'}</li>
            <li>Contratante: {status.contratanteCnpj ?? '—'}</li>
            {status.certFingerprint && (
              <li className="text-slate-400 font-mono text-xs break-all">
                fingerprint: {status.certFingerprint}
              </li>
            )}
          </ul>
        )}
        <button
          onClick={testar}
          className="mt-3 text-sm border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50"
        >
          Testar conexão
        </button>
        {conexao && <span className="ml-3 text-sm">{conexao}</span>}
      </div>

      {/* formulário */}
      <form onSubmit={salvar} className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold mb-3">Atualizar credenciais</h2>
        <p className="text-xs text-slate-400 mb-4">
          Preencha só o que quiser alterar. Campos em branco mantêm o valor já salvo.
        </p>

        <label className="block mb-3">
          <span className="block text-sm font-medium mb-1">Consumer Key</span>
          <input className="input" value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} autoComplete="off" />
        </label>
        <label className="block mb-3">
          <span className="block text-sm font-medium mb-1">Consumer Secret</span>
          <input className="input" type="password" value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} autoComplete="off" />
        </label>
        <label className="block mb-3">
          <span className="block text-sm font-medium mb-1">Certificado e-CNPJ (.pfx / .p12)</span>
          <input type="file" accept=".pfx,.p12" onChange={onArquivo} className="text-sm" />
          {pfxNome && <span className="text-xs text-brand-dark ml-2">{pfxNome}</span>}
        </label>
        <label className="block mb-3">
          <span className="block text-sm font-medium mb-1">Senha do certificado</span>
          <input className="input" type="password" value={senhaPfx} onChange={(e) => setSenhaPfx(e.target.value)} autoComplete="off" />
        </label>
        <label className="block mb-4">
          <span className="block text-sm font-medium mb-1">CNPJ contratante (Dias de Paula)</span>
          <input className="input" value={contratanteCnpj} onChange={(e) => setContratante(e.target.value)} />
        </label>

        {msg && <div className="text-sm mb-3">{msg}</div>}
        <button
          type="submit"
          disabled={salvando}
          className="bg-brand hover:bg-brand-dark text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {salvando ? 'Salvando…' : 'Salvar credenciais'}
        </button>
      </form>
    </div>
  );
}
