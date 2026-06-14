import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { ConversasController } from './conversas.controller';
import { ConversationService } from './conversation.service';
import { ConversationStateMachine } from './conversation-state-machine';
import { InboxService } from './inbox.service';
import { WhatsappProviderModule } from './providers/whatsapp-provider.module';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [WhatsappProviderModule, AiModule, AuditModule],
  controllers: [WhatsappController, ConversasController],
  providers: [ConversationService, ConversationStateMachine, InboxService],
})
export class WhatsappModule {}
