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
  driveFolderId: string | null;
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
          <BotaoDrive cliente={cliente} onCriado={carregar} />
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

      <FaturamentoMei clienteId={cliente.id} />

      <GerarDasMei clienteId={cliente.id} />

      <CertificadoMei cliente={cliente} onSalvo={carregar} />

      <NfeEntradaMei clienteId={cliente.id} temCertificado={cliente.temCertificado} />

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

interface ResumoFat {
  ano: number;
  total: number;
  limite: number;
  percentual: number;
  restante: number;
  status: 'OK' | 'ATENCAO' | 'ALERTA' | 'ESTOURADO';
}
interface Lancamento {
  id: string;
  competencia: string;
  valor: string;
  descricao: string | null;
  origem: string;
}

function BotaoDrive({ cliente, onCriado }: { cliente: ClienteFicha; onCriado: () => void }) {
  const [carregando, setCarregando] = useState(false);

  async function acao() {
    if (cliente.driveFolderId) {
      window.open(`https://drive.google.com/drive/folders/${cliente.driveFolderId}`, '_blank');
      return;
    }
    setCarregando(true);
    try {
      const r = await api.post<{ link: string }>(`/drive/cliente/${cliente.id}/pasta`);
      window.open(r.link, '_blank');
      onCriado();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao criar pasta');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <button
      onClick={acao}
      disabled={carregando}
      className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-60"
      title="Pasta no Google Drive (AtendeMEI)"
    >
      {carregando ? '…' : cliente.driveFolderId ? '📁 Abrir Drive' : '📁 Criar pasta'}
    </button>
  );
}

function FaturamentoMei({ clienteId }: { clienteId: string }) {
  const hoje = new Date();
  const [dados, setDados] = useState<{ resumo: ResumoFat; lancamentos: Lancamento[] } | null>(null);
  const [competencia, setComp] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`,
  );
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    api
      .get<{ resumo: ResumoFat; lancamentos: Lancamento[] }>(`/faturamento/cliente/${clienteId}`)
      .then(setDados)
      .catch(() => {});
  }
  useEffect(carregar, [clienteId]);

  async function lancar() {
    const v = parseFloat(valor.replace('.', '').replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return;
    setSalvando(true);
    try {
      await api.post(`/faturamento/cliente/${clienteId}`, { competencia, valor: v, descricao: descricao || undefined });
      setValor('');
      setDescricao('');
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  const r = dados?.resumo;
  const cor =
    r?.status === 'ESTOURADO'
      ? 'bg-red-500'
      : r?.status === 'ALERTA'
        ? 'bg-orange-500'
        : r?.status === 'ATENCAO'
          ? 'bg-amber-400'
          : 'bg-brand';
  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  return (
    <Secao titulo="Faturamento & limite do MEI">
      {r && (
        <>
          <div className="flex justify-between text-sm mb-1">
            <span>Ano {r.ano}: <b>R$ {fmt(r.total)}</b> de R$ {fmt(r.limite)}</span>
            <span className={r.status === 'OK' ? 'text-brand-dark' : 'text-orange-600'}>{r.percentual}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden mb-1">
            <div className={`h-3 ${cor}`} style={{ width: `${Math.min(r.percentual, 100)}%` }} />
          </div>
          <div className="text-xs text-slate-500 mb-4">
            {r.status === 'ESTOURADO'
              ? '🚨 Limite ultrapassado — orientar desenquadramento.'
              : `Restam R$ ${fmt(r.restante)} até o limite. Base para a DASN-SIMEI ${r.ano + 1}.`}
          </div>
        </>
      )}

      <div className="flex items-end gap-2 flex-wrap mb-4">
        <label className="text-sm">
          <span className="block font-medium mb-1">Competência</span>
          <input type="month" value={competencia} onChange={(e) => setComp(e.target.value)} className="input" />
        </label>
        <label className="text-sm">
          <span className="block font-medium mb-1">Valor (R$)</span>
          <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className="input w-28" />
        </label>
        <label className="text-sm flex-1 min-w-[140px]">
          <span className="block font-medium mb-1">Descrição</span>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="input" />
        </label>
        <button onClick={lancar} disabled={salvando} className="bg-brand hover:bg-brand-dark text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60">
          {salvando ? '…' : 'Lançar'}
        </button>
      </div>

      {dados && dados.lancamentos.length > 0 && (
        <div className="text-sm border-t border-slate-100 pt-2">
          {dados.lancamentos.slice(0, 6).map((l) => (
            <div key={l.id} className="flex justify-between py-1">
              <span className="text-slate-500">{l.competencia} {l.descricao ? `· ${l.descricao}` : ''}</span>
              <span>R$ {fmt(Number(l.valor))}</span>
            </div>
          ))}
        </div>
      )}
    </Secao>
  );
}

function GerarDasMei({ clienteId }: { clienteId: string }) {
  const hoje = new Date();
  const padrao = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const [competencia, setCompetencia] = useState(padrao);
  const [gerando, setGerando] = useState(false);
  const [res, setRes] = useState<{
    valorTotal?: number;
    vencimento?: string;
    linhaDigitavel?: string;
    pdfBase64?: string;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setGerando(true);
    setErro(null);
    setRes(null);
    try {
      const r = await api.post<typeof res>('/serpro/das', { clienteId, competencia });
      setRes(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar DAS');
    } finally {
      setGerando(false);
    }
  }

  function baixarPdf() {
    if (!res?.pdfBase64) return;
    const bin = atob(res.pdfBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `DAS-${competencia}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Secao titulo="DAS-MEI (SERPRO)">
      <div className="flex items-end gap-3 flex-wrap">
        <label className="text-sm">
          <span className="block font-medium mb-1">Competência</span>
          <input
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            className="input"
          />
        </label>
        <button
          onClick={gerar}
          disabled={gerando}
          className="bg-brand hover:bg-brand-dark text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {gerando ? 'Gerando…' : 'Gerar DAS'}
        </button>
      </div>

      {erro && <div className="text-red-600 text-sm mt-3">{erro}</div>}
      {res && (
        <div className="mt-4 text-sm space-y-1">
          <div>✅ Guia gerada{res.valorTotal ? ` — R$ ${Number(res.valorTotal).toFixed(2)}` : ''}</div>
          {res.vencimento && <div>Vencimento: {new Date(res.vencimento).toLocaleDateString('pt-BR')}</div>}
          {res.linhaDigitavel && (
            <div className="font-mono text-xs break-all">Linha: {res.linhaDigitavel}</div>
          )}
          {res.pdfBase64 && (
            <button onClick={baixarPdf} className="mt-2 text-brand hover:underline">
              ⬇ Baixar PDF da DAS
            </button>
          )}
        </div>
      )}
    </Secao>
  );
}

interface NfeEntrada {
  id: string;
  chave: string;
  emitenteNome: string | null;
  emitenteCnpj: string | null;
  valorTotal: string | null;
  dataEmissao: string | null;
  situacao: string | null;
}

function NfeEntradaMei({ clienteId, temCertificado }: { clienteId: string; temCertificado: boolean }) {
  const [notas, setNotas] = useState<NfeEntrada[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function carregar() {
    api.get<NfeEntrada[]>(`/nfe/cliente/${clienteId}`).then(setNotas).catch(() => {});
  }
  useEffect(carregar, [clienteId]);

  async function buscar() {
    setBuscando(true);
    setMsg(null);
    try {
      const r = await api.post<{ baixadas: number; cstat: string; motivo: string }>(
        `/nfe/cliente/${clienteId}/buscar`,
      );
      setMsg(`${r.baixadas} nova(s) nota(s). SEFAZ: ${r.cstat} ${r.motivo || ''}`);
      carregar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro na busca');
    } finally {
      setBuscando(false);
    }
  }

  const fmt = (v: string | null) => (v ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—');

  return (
    <Secao titulo="NF-e de entrada (SEFAZ)">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={buscar}
          disabled={buscando || !temCertificado}
          className="bg-brand hover:bg-brand-dark text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          title={!temCertificado ? 'Cadastre o certificado A1 do MEI primeiro' : ''}
        >
          {buscando ? 'Buscando na SEFAZ…' : 'Buscar NF-e na SEFAZ'}
        </button>
        {!temCertificado && (
          <span className="text-xs text-amber-600">Requer o certificado A1 do MEI.</span>
        )}
      </div>
      {msg && <div className="text-sm text-slate-500 mb-3">{msg}</div>}

      {notas.length === 0 ? (
        <p className="text-slate-400 text-sm">Nenhuma NF-e de entrada baixada ainda.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left">
            <tr>
              <th className="py-1 font-medium">Emitente</th>
              <th className="py-1 font-medium">Data</th>
              <th className="py-1 font-medium text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {notas.map((n) => (
              <tr key={n.id} className="border-t border-slate-100">
                <td className="py-1">
                  <div>{n.emitenteNome ?? '—'}</div>
                  <div className="text-xs text-slate-400 font-mono">{n.chave.slice(0, 24)}…</div>
                </td>
                <td className="py-1">
                  {n.dataEmissao ? new Date(n.dataEmissao).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="py-1 text-right">R$ {fmt(n.valorTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Secao>
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
