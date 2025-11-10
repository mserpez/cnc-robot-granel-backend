import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullBoardService } from './bull-board.service';
import { QueueService } from './queue.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [QueueService, BullBoardService],
  exports: [QueueService, BullBoardService],
})
export class QueueModule {}
