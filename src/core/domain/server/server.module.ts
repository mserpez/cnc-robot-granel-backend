import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { LoggingModule } from '../../infrastructure/logging/logging.module';
import { MqttModule } from '../../infrastructure/mqtt/mqtt.module';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { ServerService } from './server.service';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    LoggingModule,
    forwardRef(() => MqttModule), // forwardRef porque MqttModule puede depender de otros módulos
  ],
  providers: [ServerService],
  exports: [ServerService],
})
export class ServerModule {}
