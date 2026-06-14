import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AnexoSaida,
  MensagemEnviada,
  WhatsappProvider,
} from './whatsapp-provider.interface';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const baileys = require('@whiskeysockets/baileys');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCode = require('qrcode');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pino = require('pino');

export interface MensagemInbound {
  tenantId: string;
  telefoneWa: string; // E.164
  texto: string;
  externalId: string;
}

// Provider real do WhatsApp via Baileys (WhatsApp Web). Mantém a sessão em
// disco (volume), expõe o QR para o painel e entrega as mensagens recebidas
// a um handler registrado pelo ConversationService (sem dependência circular).
@Injectable()
export class BaileysWhatsappProvider implements WhatsappProvider {
  private readonly logger = new Logger('Baileys');
  private sock: any = null;
  private tenantId = '';
  private conectando = false;
  private handler?: (msg: MensagemInbound) => Promise<void>;
  private readonly sessionRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.sessionRoot = config.get<string>('WHATSAPP_SESSION_PATH') ?? '/app/sessions';
  }

  registrarHandler(fn: (msg: MensagemInbound) => Promise<void>) {
    this.handler = fn;
  }

  // ───────── ciclo de vida da conexão ─────────

  async iniciar(tenantId: string) {
    this.tenantId = tenantId;
    await this.conectar();
  }

  private async conectar() {
    if (this.conectando) return;
    this.conectando = true;
    try {
      const {
        useMultiFileAuthState,
        DisconnectReason,
        fetchLatestBaileysVersion,
        Browsers,
      } = baileys;
      const makeWASocket = baileys.default ?? baileys.makeWASocket;

      const sessionPath = path.join(this.sessionRoot, this.tenantId);
      fs.mkdirSync(sessionPath, { recursive: true });
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      let version: any;
      try {
        ({ version } = await fetchLatestBaileysVersion());
      } catch {
        version = undefined;
      }

      this.sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        logger: pino({ level: 'silent' }),
        getMessage: async () => undefined,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          const dataUrl = await QRCode.toDataURL(qr);
          await this.salvarConexao({ status: 'QRCODE', qrcode: dataUrl });
          this.logger.log('Novo QR code gerado — escaneie no painel');
        }
        if (connection === 'open') {
          const numero = this.sock?.user?.id?.split(':')[0];
          await this.salvarConexao({
            status: 'CONECTADO',
            numero: numero ? `+${numero}` : null,
            qrcode: null,
          });
          this.logger.log(`WhatsApp conectado: ${numero}`);
        }
        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          const deslogou = code === DisconnectReason?.loggedOut;
          await this.salvarConexao({
            status: deslogou ? 'DESCONECTADO' : 'QRCODE',
          });
          this.conectando = false;
          if (!deslogou) {
            this.logger.warn(`Conexão caiu (${code}) — reconectando…`);
            setTimeout(() => this.conectar().catch(() => undefined), 3000);
          } else {
            this.logger.warn('Sessão deslogada — limpe e gere novo QR.');
          }
        }
      });

      this.sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
        if (type !== 'notify') return;
        for (const m of messages) {
          try {
            await this.processarInbound(m);
          } catch (e) {
            this.logger.error(`inbound erro: ${e}`);
          }
        }
      });
    } finally {
      this.conectando = false;
    }
  }

  private async processarInbound(m: any) {
    if (!m.message || m.key.fromMe) return;
    const jid: string = m.key.remoteJid ?? '';
    if (!jid.endsWith('@s.whatsapp.net')) return; // ignora grupos/status
    const texto =
      m.message.conversation ??
      m.message.extendedTextMessage?.text ??
      m.message.imageMessage?.caption ??
      m.message.documentMessage?.caption ??
      '';
    if (!texto.trim()) return;

    const numero = jid.split('@')[0];
    if (this.handler) {
      await this.handler({
        tenantId: this.tenantId,
        telefoneWa: `+${numero}`,
        texto,
        externalId: m.key.id,
      });
    }
  }

  private async salvarConexao(data: {
    status?: string;
    numero?: string | null;
    qrcode?: string | null;
  }) {
    try {
      await this.prisma.whatsappConexao.upsert({
        where: { tenantId: this.tenantId },
        create: { tenantId: this.tenantId, ...data },
        update: data,
      });
    } catch (e) {
      this.logger.error(`salvarConexao erro: ${e}`);
    }
  }

  async desconectar() {
    try {
      await this.sock?.logout();
    } catch {
      /* ignore */
    }
    const sessionPath = path.join(this.sessionRoot, this.tenantId);
    fs.rmSync(sessionPath, { recursive: true, force: true });
    await this.salvarConexao({ status: 'DESCONECTADO', numero: null, qrcode: null });
    this.sock = null;
    setTimeout(() => this.conectar().catch(() => undefined), 1500);
  }

  // ───────── WhatsappProvider ─────────

  private jid(para: string) {
    return `${para.replace(/\D/g, '')}@s.whatsapp.net`;
  }

  async enviarTexto(para: string, texto: string): Promise<MensagemEnviada> {
    const res = await this.sock.sendMessage(this.jid(para), { text: texto });
    return { externalId: res?.key?.id ?? `bly-${Date.now()}` };
  }

  async enviarDocumento(para: string, anexo: AnexoSaida): Promise<MensagemEnviada> {
    const res = await this.sock.sendMessage(this.jid(para), {
      document: { url: anexo.url },
      mimetype: anexo.tipo === 'image' ? 'image/png' : 'application/pdf',
      fileName: anexo.caption ?? 'documento',
      caption: anexo.caption,
    });
    return { externalId: res?.key?.id ?? `bly-${Date.now()}` };
  }
}
