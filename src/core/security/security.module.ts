import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModule,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): ThrottlerModuleOptions => {
        const ttl = parseInt(config.get<string>('THROTTLE_TTL', '60'), 10);
        const limit = parseInt(config.get<string>('THROTTLE_LIMIT', '30'), 10);

        return [
          {
            ttl: Number.isNaN(ttl) ? 60 : ttl,
            limit: Number.isNaN(limit) ? 30 : limit,
          },
        ];
      },
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class SecurityModule {}
