// Abstração da camada fiscal (cadastro + emissão). A conversa/painel só
// conhecem esta interface. Implementações: FakeFiscalProvider | OmieFiscalProvider.

export const FISCAL_PROVIDER = Symbol('FISCAL_PROVIDER');

export interface CadastrarClienteInput {
  cnpj: string; // 14 dígitos (somente números)
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  email?: string | null;
  telefone?: string | null; // E.164 ou nacional
  // endereço é opcional aqui; a Omie completa pelo CNPJ quando possível
}

export interface CadastrarClienteResult {
  // identificador do cliente no provedor (ex.: codigo_cliente_omie)
  codigoProvider: string;
  jaExistia: boolean;
}

export interface EmitirNFSeInput {
  codigoClienteProvider?: string; // se já cadastrado; senão o provider cadastra
  cliente: CadastrarClienteInput;
  descricao: string;
  valor: number;
}

export interface EmitirNFSeResult {
  status: 'EMITIDA' | 'PENDENTE' | 'ERRO';
  numero?: string;
  pdfUrl?: string;
  providerRef?: string; // id da OS/nota no provedor
  erro?: string; // mensagem amigável quando status = ERRO
}

export interface FiscalProvider {
  nome(): string;
  cadastrarCliente(input: CadastrarClienteInput): Promise<CadastrarClienteResult>;
  emitirNFSe(input: EmitirNFSeInput): Promise<EmitirNFSeResult>;
}
