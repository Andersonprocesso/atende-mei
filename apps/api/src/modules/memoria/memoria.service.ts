import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';

export interface MemoriaItem {
  pergunta: string;
  resposta: string;
  similaridade: number;
}

// Memória de IA com aprendizado contínuo (RAG via pgvector).
// Guarda pares pergunta→resposta com embedding e recupera os mais parecidos
// para dar contexto às próximas respostas. Espelha o padrão do EsconZap.
@Injectable()
export class MemoriaService implements OnModuleInit {
  private readonly logger = new Logger('MemoriaIA');
  private pronto = false;
  private readonly dim: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
    config: ConfigService,
  ) {
    this.dim = parseInt(config.get<string>('EMBEDDINGS_DIM') ?? '768', 10);
  }

  get habilitado(): boolean {
    return this.pronto && this.embedding.configurado;
  }

  async onModuleInit() {
    if (!this.embedding.configurado) {
      this.logger.log('Memória desligada (EMBEDDINGS_API_URL ausente)');
      return;
    }
    try {
      await this.prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ai_memories (
          id SERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          pergunta TEXT,
          resposta TEXT,
          embedding vector(${this.dim}),
          criado_em TIMESTAMPTZ DEFAULT now()
        );
      `);
      await this.prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS ai_memories_tenant_idx ON ai_memories(tenant_id);',
      );
      this.pronto = true;
      this.logger.log('Memória pronta (pgvector + ai_memories)');
    } catch (e) {
      this.pronto = false;
      this.logger.error(`Memória init falhou (pgvector indisponível?): ${e}`);
    }
  }

  private toVector(arr: number[]): string {
    return `[${arr.join(',')}]`;
  }

  // Aprendizado: guarda um par pergunta→resposta.
  async aprender(tenantId: string, pergunta: string, resposta: string) {
    if (!this.habilitado) return;
    const q = (pergunta || '').trim();
    const a = (resposta || '').trim();
    if (!q || !a) return;
    try {
      const vec = await this.embedding.embed(q);
      if (!vec) return;
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO ai_memories (tenant_id, pergunta, resposta, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        tenantId,
        q,
        a,
        this.toVector(vec),
      );
    } catch (e) {
      this.logger.error(`aprender erro: ${e}`);
    }
  }

  // Recupera as memórias mais parecidas com a pergunta atual.
  async buscar(
    tenantId: string,
    query: string,
    k = 4,
    minSimilaridade = 0.78,
  ): Promise<MemoriaItem[]> {
    if (!this.habilitado) return [];
    try {
      const vec = await this.embedding.embed(query);
      if (!vec) return [];
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT pergunta, resposta, 1 - (embedding <=> $1::vector) AS similaridade
           FROM ai_memories
          WHERE tenant_id = $2
          ORDER BY embedding <=> $1::vector
          LIMIT $3`,
        this.toVector(vec),
        tenantId,
        k,
      );
      return rows
        .map((r) => ({
          pergunta: r.pergunta,
          resposta: r.resposta,
          similaridade: Number(r.similaridade),
        }))
        .filter((r) => r.similaridade >= minSimilaridade);
    } catch (e) {
      this.logger.error(`buscar erro: ${e}`);
      return [];
    }
  }
}
