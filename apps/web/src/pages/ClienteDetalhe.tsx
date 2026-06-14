import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api, Cliente } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { EditarClienteModal } from '../components/EditarClienteModal';
import { useAuth } from '../lib/auth';

interface ClienteFicha extends Cliente {
  certificadoNome: string | null;
  certificadoValidade: string | null;
  certificadoFingerprint: string | null;
  temCertificado: boolean;
  cpfProprietario: string | null;
  omieCodigoCliente: string | null;
  assinaturas: { id: string; status: string; plano: { nome: string } }[];
  _count: { notas: number; guias: number; conversas: number };
}

export default function ClienteDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [cliente, setCliente] = useState<ClienteFicha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);

  function carregar() {
    api.get<ClienteFicha>(`/clientes/${id}`).then(setCliente).catch((e) => setErro(e.message));
  }
  useEffect(carregar, [id]);

  async function excluir() {
    if (!confirm('Excluir definitivamente este MEI? Esta ação não pode ser desfeita.')) return;
    try {
      await api.del(`/clientes/${id}/remover`);
      navigate('/clientes');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir');
    }
  }

  if (erro) return <div className="text-red-600">{erro}</div>;
  if (!cliente) return <div className="text-slate-400">Carregando…</div>;

  const assinatura = cliente.assinaturas[0];

  return (
    <div className="max-w-4xl">
      <Link to="/clientes" className="text-brand text-sm hover:underline">
        ← Voltar à carteira
      </Link>

      <div className="flex items-start justify-between mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {cliente.nomeFantasia ?? cliente.razaoSocial ?? cliente.cnpj}
          </h1>
          <p className="text-slate-500">{cliente.razaoSocial}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge situacao={cliente.situacaoFiscal} />
          <button
            onClick={() => setEditando(true)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50"
          >
            Editar
          </button>
          {usuario?.role === 'ADMIN' && (
            <button
              onClick={excluir}
              className="text-sm border border-red-200 text-red-600 rounded-lg px-3 py-1.5 hover:bg-red-50"
            >
              Excluir
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card titulo="Notas emitidas" valor={cliente._count.notas} />
        <Card titulo="Guias DAS" valor={cliente._count.guias} />
        <Card titulo="Conversas" valor={cliente._count.conversas} />
      </div>

      <Secao titulo="Dados cadastrais">
        <Linha rotulo="CNPJ" valor={cliente.cnpj ?? '—'} mono />
        <Linha rotulo="Razão social" valor={cliente.razaoSocial ?? '—'} />
        <Linha rotulo="Contato" valor={cliente.nomeContato ?? '—'} />
        <Linha rotulo="WhatsApp" valor={cliente.telefoneWa ?? '—'} />
        <Linha rotulo="E-mail" valor={cliente.email ?? '—'} />
        <Linha rotulo="CPF do titular" valor={cliente.cpfProprietario ?? '—'} />
        <Linha rotulo="Código Omie" valor={cliente.omieCodigoCliente ?? '—'} />
        <Linha rotulo="Ativo" valor={cliente.ativo ? 'Sim' : 'Não'} />
      </Secao>

      <Secao titulo="Plano / Assinatura">
        {assinatura ? (
          <>
            <Linha rotulo="Plano" valor={assinatura.plano.nome} />
            <Linha rotulo="Status" valor={assinatura.status} />
          </>
        ) : (
          <p className="text-slate-400 text-sm">Sem assinatura ativa (etapa 5).</p>
        )}
      </Secao>

      <CertificadoMei cliente={cliente} onSalvo={carregar} />

      {editando && (
        <EditarClienteModal
          cliente={cliente}
          onFechar={() => setEditando(false)}
          onSalvo={() => {
            setEditando(false);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function CertificadoMei({
  cliente,
  onSalvo,
}: {
  cliente: ClienteFicha;
  onSalvo: () => void;
}) {
  const [pfxBase64, setPfx] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [validade, setValidade] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setNome(f.name);
    const r = new FileReader();
    r.onload = () => setPfx(String(r.result).split(',')[1] ?? '');
    r.readAsDataURL(f);
  }

  async function salvar() {
    if (!pfxBase64 || !senha) {
      setMsg('Selecione o arquivo .pfx e informe a senha.');
      return;
    }
    setSalvando(true);
    setMsg(null);
    try {
      await api.post(`/clientes/${cliente.id}/certificado`, {
        pfxBase64,
        senha,
        nome,
        validade: validade || undefined,
      });
      setMsg('Certificado salvo com segurança ✅');
      setPfx('');
      setSenha('');
      onSalvo();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Secao titulo="Certificado digital A1 (e-CNPJ do MEI)">
      <div className="text-sm mb-3">
        {cliente.temCertificado ? (
          <span className="text-brand-dark">
            ✅ Certificado cadastrado{cliente.certificadoNome ? ` — ${cliente.certificadoNome}` : ''}
            {cliente.certificadoValidade
              ? ` (válido até ${new Date(cliente.certificadoValidade).toLocaleDateString('pt-BR')})`
              : ''}
          </span>
        ) : (
          <span className="text-slate-400">Nenhum certificado vinculado.</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block font-medium mb-1">Arquivo .pfx / .p12</span>
          <input type="file" accept=".pfx,.p12" onChange={onArquivo} className="text-sm" />
        </label>
        <label className="text-sm">
          <span className="block font-medium mb-1">Senha do certificado</span>
          <input className="input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="off" />
        </label>
        <label className="text-sm">
          <span className="block font-medium mb-1">Validade (opcional)</span>
          <input className="input" type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
        </label>
      </div>

      {msg && <div className="text-sm mt-3">{msg}</div>}
      <button
        onClick={salvar}
        disabled={salvando}
        className="mt-3 bg-brand hover:bg-brand-dark text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {salvando ? 'Salvando…' : 'Salvar certificado'}
      </button>
    </Secao>
  );
}

function Card({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="text-sm text-slate-500">{titulo}</div>
      <div className="text-2xl font-bold mt-1">{valor}</div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
      <h2 className="font-semibold mb-3">{titulo}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Linha({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex text-sm">
      <span className="w-40 text-slate-500">{rotulo}</span>
      <span className={mono ? 'font-mono' : ''}>{valor}</span>
    </div>
  );
}
