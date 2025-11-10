import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  LoggingModule,
  QueueModule,
  SecurityModule,
  SystemModule,
} from './core';
import {
  HardwareCommunicationModule,
  IntakeOrdersModule,
  PrepareOrdersModule,
} from './modules';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggingModule,
    QueueModule,
    PrismaModule,
    SecurityModule,
    SystemModule,
    IntakeOrdersModule,
    PrepareOrdersModule,
    HardwareCommunicationModule,
  ],
})
export class AppModule {}
