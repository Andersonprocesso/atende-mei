import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { MemoriaService } from './memoria.service';

@Module({
  providers: [EmbeddingService, MemoriaService],
  exports: [MemoriaService],
})
export class MemoriaModule {}
