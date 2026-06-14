import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SituacaoFiscal } from '@prisma/client';

// Filtros e paginação da lista da carteira.
export class QueryClientesDto {
  // busca textual em razão social, nome fantasia, contato, cnpj ou telefone
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(SituacaoFiscal)
  situacaoFiscal?: SituacaoFiscal;

  // 'true' | 'false' como string vinda da query
  @IsOptional()
  @IsString()
  ativo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
