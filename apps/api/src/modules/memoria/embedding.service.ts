import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Gera embeddings (vetores) de texto via um endpoint OpenAI-compatível
// (Ollama/LM Studio/OpenAI). Sem configuração, devolve null (memória desliga).
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger('Embedding');
  private readonly url: string;
  private readonly model: string;
  private readonly key: string;

  constructor(config: ConfigService) {
    this.url = (config.get<string>('EMBEDDINGS_API_URL') ?? '').trim();
    this.model = config.get<string>('EMBEDDINGS_MODEL') ?? 'nomic-embed-text';
    this.key = config.get<string>('EMBEDDINGS_API_KEY') ?? '';
  }

  get configurado(): boolean {
    return !!this.url;
  }

  async embed(texto: string): Promise<number[] | null> {
    if (!this.configurado) return null;
    const input = (texto || '').slice(0, 8000);
    if (!input.trim()) return null;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.key) headers.Authorization = `Bearer ${this.key}`;
      const res = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: this.model, input }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: any = await res.json();
      // OpenAI: { data: [{ embedding }] } | Ollama nativo: { embedding }
      return data?.data?.[0]?.embedding ?? data?.embedding ?? null;
    } catch (e) {
      this.logger.error(`embed erro: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }
}
