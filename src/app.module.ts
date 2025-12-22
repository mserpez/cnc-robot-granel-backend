import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  DashboardModule,
  LoggingModule,
  MqttModule,
  PeripheralCoordinatorModule,
  QueueModule,
  SecurityModule,
  SystemModule,
} from './core';
import {
  IntakeOrdersModule,
  MotorMovementsModule,
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
    MqttModule,
    DashboardModule,
    PeripheralCoordinatorModule,
    IntakeOrdersModule,
    PrepareOrdersModule,
    MotorMovementsModule,
  ],
})
export class AppModule {}
