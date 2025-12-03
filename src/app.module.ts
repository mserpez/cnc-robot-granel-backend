import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  DiscoveryModule,
  LoggingModule,
  MqttModule,
  QueueModule,
  SecurityModule,
  SystemModule,
} from './core';
import {
  HardwareCommunicationModule,
  IntakeOrdersModule,
  PrepareOrdersModule,
  MotorMovementsModule,
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
    DiscoveryModule,
    MqttModule,
    IntakeOrdersModule,
    PrepareOrdersModule,
    MotorMovementsModule,
    HardwareCommunicationModule,
  ],
})
export class AppModule {}
