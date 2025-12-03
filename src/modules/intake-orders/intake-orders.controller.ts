import { Controller, Get, Param, ParseFloatPipe } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PrepareOrderJobPayload } from '../prepare-orders';
import { IntakeOrdersService } from './intake-orders.service';

@Controller()
export class IntakeOrdersController {
  constructor(private readonly intakeOrdersService: IntakeOrdersService) {}

  @Get('create-order/:productId/:weightGrams')
  async createOrder(
    @Param('productId') productId: string,
    @Param('weightGrams', ParseFloatPipe) weightGrams: number,
  ): Promise<Record<string, unknown>> {
    const payload: PrepareOrderJobPayload = {
      orderId: randomUUID(),
      productId,
      hopperId: `hopper-${productId}`,
      weightGrams,
    };

    const { queue, jobId } =
      await this.intakeOrdersService.enqueueOrder(payload);

    return {
      message: 'Order enqueued',
      queue,
      jobId,
      payload,
    };
  }
}
