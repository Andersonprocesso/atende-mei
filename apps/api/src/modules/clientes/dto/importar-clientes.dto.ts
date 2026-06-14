import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export class ImportarClienteItemDto {
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
  cpfProprietario?: string;

  @IsOptional()
  @IsString()
  omieCodigoCliente?: string;
}

export class ImportarClientesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportarClienteItemDto)
  clientes!: ImportarClienteItemDto[];
}
