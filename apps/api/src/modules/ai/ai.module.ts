import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_ASSISTANT } from './ai-assistant.interface';
import { MockAIProvider } from './mock-ai.provider';

// Seleciona o adapter de IA conforme AI_PROVIDER. Hoje só "mock";
// "openai"/"anthropic" devem implementar AIAssistant e ser plugados aqui.
@Module({
  providers: [
    MockAIProvider,
    {
      provide: AI_ASSISTANT,
      inject: [ConfigService, MockAIProvider],
      useFactory: (config: ConfigService, mock: MockAIProvider) => {
        const provider = config.get<string>('AI_PROVIDER') ?? 'mock';
        switch (provider) {
          case 'mock':
            return mock;
          default:
            throw new Error(
              `AI_PROVIDER="${provider}" ainda não implementado. ` +
                `Implemente um AIAssistant e registre-o em ai.module.ts.`,
            );
        }
      },
    },
  ],
  exports: [AI_ASSISTANT],
})
export class AiModule {}
