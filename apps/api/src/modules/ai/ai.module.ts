import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_ASSISTANT } from './ai-assistant.interface';
import { MockAIProvider } from './mock-ai.provider';
import { OpenRouterAIProvider } from './openrouter-ai.provider';
import { MemoriaModule } from '../memoria/memoria.module';

// Seleciona o adapter de IA conforme AI_PROVIDER (mock | openrouter).
@Module({
  imports: [MemoriaModule],
  providers: [
    MockAIProvider,
    OpenRouterAIProvider,
    {
      provide: AI_ASSISTANT,
      inject: [ConfigService, MockAIProvider, OpenRouterAIProvider],
      useFactory: (
        config: ConfigService,
        mock: MockAIProvider,
        openrouter: OpenRouterAIProvider,
      ) => {
        const provider = config.get<string>('AI_PROVIDER') ?? 'mock';
        switch (provider) {
          case 'openrouter':
            return openrouter;
          case 'mock':
            return mock;
          default:
            throw new Error(
              `AI_PROVIDER="${provider}" não implementado. Use mock | openrouter.`,
            );
        }
      },
    },
  ],
  exports: [AI_ASSISTANT],
})
export class AiModule {}
