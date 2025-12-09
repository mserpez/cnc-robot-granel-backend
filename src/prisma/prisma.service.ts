import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    try {
      // Intentar conectar con timeout de 5 segundos
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Database connection timeout')),
          5000,
        );
      });

      await Promise.race([this.$connect(), timeoutPromise]);
    } catch (error) {
      // No crashear el servidor si la DB está caída
      // El servidor puede iniciar sin DB y el dashboard mostrará el estado
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(
        `[PrismaService] Failed to connect to database: ${errorMessage}. Server will continue without database connection.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
    await this.$disconnect();
    } catch (error) {
      // Ignorar errores al desconectar
    }
  }
}
