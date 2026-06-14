import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, Cliente } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';

interface ClienteFicha extends Cliente {
  razaoSocial: string | null;
  certificadoNome: string | null;
  certificadoValidade: string | null;
  assinaturas: { id: string; status: string; plano: { nome: string } }[];
  _count: { notas: number; guias: number; conversas: number };
}

export default function ClienteDetalhe() {
  const { id } = useParams();
  const [cliente, setCliente] = useState<ClienteFicha | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ClienteFicha>(`/clientes/${id}`)
      .then(setCliente)
      .catch((e) => setErro(e.message));
  }, [id]);

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
        <StatusBadge situacao={cliente.situacaoFiscal} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card titulo="Notas emitidas" valor={cliente._count.notas} />
        <Card titulo="Guias DAS" valor={cliente._count.guias} />
        <Card titulo="Conversas" valor={cliente._count.conversas} />
      </div>

      <Secao titulo="Dados cadastrais">
        <Linha rotulo="CNPJ" valor={cliente.cnpj} mono />
        <Linha rotulo="Razão social" valor={cliente.razaoSocial ?? '—'} />
        <Linha rotulo="Contato" valor={cliente.nomeContato ?? '—'} />
        <Linha rotulo="WhatsApp" valor={cliente.telefoneWa} />
        <Linha rotulo="E-mail" valor={cliente.email ?? '—'} />
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

      <Secao titulo="Certificado digital A1 (e-CNPJ)">
        {cliente.certificadoNome ? (
          <>
            <Linha rotulo="Arquivo" valor={cliente.certificadoNome} />
            <Linha
              rotulo="Validade"
              valor={
                cliente.certificadoValidade
                  ? new Date(cliente.certificadoValidade).toLocaleDateString('pt-BR')
                  : '—'
              }
            />
          </>
        ) : (
          <p className="text-slate-400 text-sm">Nenhum certificado vinculado.</p>
        )}
      </Secao>

      <p className="text-xs text-slate-400 mt-6">
        Histórico de conversas, emissões e cobranças aparecem aqui nas etapas 3–6.
      </p>
    </div>
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

function Linha({
  rotulo,
  valor,
  mono,
}: {
  rotulo: string;
  valor: string;
  mono?: boolean;
}) {
  return (
    <div className="flex text-sm">
      <span className="w-40 text-slate-500">{rotulo}</span>
      <span className={mono ? 'font-mono' : ''}>{valor}</span>
    </div>
  );
}
