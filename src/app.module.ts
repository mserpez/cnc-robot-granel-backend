import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggingModule } from './core/logging/logging.module';
import { SecurityModule } from './core/security/security.module';
import { SystemModule } from './core/system/system.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggingModule,
    PrismaModule,
    SecurityModule,
    SystemModule,
  ],
})
export class AppModule {}
