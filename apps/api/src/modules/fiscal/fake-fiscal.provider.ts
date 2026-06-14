import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CadastrarClienteInput,
  CadastrarClienteResult,
  EmitirNFSeInput,
  EmitirNFSeResult,
  FiscalProvider,
} from './fiscal-provider.interface';

// Adapter fiscal de desenvolvimento: não chama nenhum órgão/ERP.
// Gera identificadores e um "PDF" stub para desenvolver o fluxo localmente.
@Injectable()
export class FakeFiscalProvider implements FiscalProvider {
  nome() {
    return 'fake';
  }

  async cadastrarCliente(
    input: CadastrarClienteInput,
  ): Promise<CadastrarClienteResult> {
    return { codigoProvider: `fake-${input.cnpj}`, jaExistia: false };
  }

  async emitirNFSe(input: EmitirNFSeInput): Promise<EmitirNFSeResult> {
    const id = randomUUID();
    return {
      status: 'EMITIDA',
      numero: id.slice(0, 8),
      providerRef: id,
      pdfUrl: `https://exemplo.local/nfse/${id}.pdf`,
    };
  }
}
