import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

interface Conexao {
  status: 'DESCONECTADO' | 'QRCODE' | 'CONECTADO';
  numero: string | null;
  qrcode: string | null;
  atualizadoEm: string | null;
}

export default function Whatsapp() {
  const [con, setCon] = useState<Conexao | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  function carregar() {
    api.get<Conexao>('/whatsapp-conexao').then(setCon).catch(() => {});
  }

  useEffect(() => {
    carregar();
    timer.current = window.setInterval(carregar, 4000); // QR/status mudam rápido
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  async function reconectar() {
    setMsg('Solicitando conexão… aguarde o QR aparecer.');
    try {
      await api.post('/whatsapp-conexao/reconectar');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    }
  }

  async function desconectar() {
    if (!confirm('Desconectar o WhatsApp e limpar a sessão?')) return;
    setMsg('Desconectando…');
    try {
      await api.post('/whatsapp-conexao/desconectar');
      setMsg('Desconectado. Clique em "Gerar QR" para conectar de novo.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    }
  }

  const status = con?.status ?? 'DESCONECTADO';

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-1">WhatsApp (Baileys)</h1>
      <p className="text-slate-500 mb-6">
        Conexão do número de atendimento do MEI. Escaneie o QR com o WhatsApp da Dias de Paula.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-slate-500">Status:</span>
          <span
            className={
              'text-sm font-semibold ' +
              (status === 'CONECTADO'
                ? 'text-brand-dark'
                : status === 'QRCODE'
                  ? 'text-amber-600'
                  : 'text-slate-500')
            }
          >
            {status === 'CONECTADO'
              ? `✅ Conectado ${con?.numero ?? ''}`
              : status === 'QRCODE'
                ? '📷 Aguardando leitura do QR'
                : '⚪ Desconectado'}
          </span>
        </div>

        {status === 'QRCODE' && con?.qrcode && (
          <div className="flex flex-col items-center py-4">
            <img src={con.qrcode} alt="QR code do WhatsApp" className="w-64 h-64" />
            <p className="text-sm text-slate-500 mt-3 text-center">
              No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho → aponte para este QR.
            </p>
          </div>
        )}

        {status === 'CONECTADO' && (
          <div className="bg-green-50 text-green-800 rounded-lg p-4 text-sm">
            Tudo certo! As mensagens recebidas neste número já entram no atendimento automático.
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={reconectar}
            className="bg-brand hover:bg-brand-dark text-white rounded-lg px-4 py-2 text-sm font-medium"
          >
            {status === 'CONECTADO' ? 'Reconectar' : 'Gerar QR / Conectar'}
          </button>
          {status === 'CONECTADO' && (
            <button
              onClick={desconectar}
              className="border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm hover:bg-red-50"
            >
              Desconectar
            </button>
          )}
        </div>
        {msg && <div className="text-sm text-slate-500 mt-3">{msg}</div>}
      </div>
    </div>
  );
}
