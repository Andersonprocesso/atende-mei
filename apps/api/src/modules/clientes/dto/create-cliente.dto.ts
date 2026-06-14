import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { SituacaoFiscal } from '@prisma/client';

export class CreateClienteDto {
  @IsString()
  @Matches(/^\d{14}$/, { message: 'cnpj deve ter 14 dígitos' })
  cnpj!: string;

  @IsOptional()
  @IsString()
  razaoSocial?: string;

  @IsOptional()
  @IsString()
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  nomeContato?: string;

  // E.164, ex.: +5511999999999
  @IsString()
  @Matches(/^\+\d{10,15}$/, { message: 'telefoneWa deve estar em formato E.164' })
  telefoneWa!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(SituacaoFiscal)
  situacaoFiscal?: SituacaoFiscal;
}
