import { IsString, Matches } from 'class-validator';

// Payload normalizado de entrada (o adapter da Cloud API converte o formato
// da Meta para este shape antes de chamar o serviço).
export class InboundMessageDto {
  @IsString()
  tenantId!: string;

  @IsString()
  @Matches(/^\+\d{10,15}$/, { message: 'from deve estar em E.164' })
  from!: string;

  @IsString()
  text!: string;

  // id da mensagem no provedor — usado para idempotência
  @IsString()
  messageId!: string;
}
