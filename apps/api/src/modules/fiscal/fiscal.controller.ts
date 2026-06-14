import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { OmieClient, OmieApiError } from './omie/omie.client';

// Diagnóstico fiscal (somente ADMIN). Operações de leitura — não cria dados.
@Roles(UserRole.ADMIN)
@Controller('fiscal')
export class FiscalController {
  constructor(private readonly omie: OmieClient) {}

  // Verifica conectividade/credenciais com a Omie sem alterar nada.
  @Get('omie/status')
  async omieStatus() {
    if (!this.omie.configurado) {
      return { configurado: false, conectado: false };
    }
    try {
      const resp = await this.omie.call('geral/clientes', 'ListarClientes', {
        pagina: 1,
        registros_por_pagina: 1,
        apenas_importado_api: 'N',
      });
      return {
        configurado: true,
        conectado: true,
        totalClientesOmie: resp?.total_de_registros ?? null,
      };
    } catch (e) {
      return {
        configurado: true,
        conectado: false,
        erro: e instanceof OmieApiError ? e.message : 'Falha ao conectar',
      };
    }
  }
}
