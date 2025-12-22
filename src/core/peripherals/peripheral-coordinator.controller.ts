import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { LEDService } from './leds/leds.service';
import type { LEDCommand, LEDConfig } from './leds/leds.types';
import { PeripheralCoordinatorService } from './peripheral-coordinator.service';
import type { PeripheralInfo } from './peripheral-coordinator.types';

@Controller('peripherals')
export class PeripheralCoordinatorController {
  constructor(
    private readonly coordinatorService: PeripheralCoordinatorService,
    private readonly ledService: LEDService,
  ) {}

  /**
   * Obtener todos los periféricos de un dispositivo
   */
  @Get('devices/:deviceUuid')
  async getPeripherals(
    @Param('deviceUuid') deviceUuid: string,
  ): Promise<PeripheralInfo[]> {
    return this.coordinatorService.getPeripheralsByDevice(deviceUuid);
  }

  /**
   * Crear un LED
   */
  @Post('devices/:deviceUuid/leds/:componentId')
  async createLED(
    @Param('deviceUuid') deviceUuid: string,
    @Param('componentId') componentId: string,
    @Body() config: LEDConfig,
  ): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      await this.ledService.createLED(deviceUuid, componentId, config);
      return {
        success: true,
        message: `LED ${componentId} created successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: `LED ${componentId} configuration failed`,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Actualizar configuración de un LED
   */
  @Put('devices/:deviceUuid/leds/:componentId')
  async updateLED(
    @Param('deviceUuid') deviceUuid: string,
    @Param('componentId') componentId: string,
    @Body() config: LEDConfig,
  ): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      await this.ledService.updateLED(deviceUuid, componentId, config);
      return {
        success: true,
        message: `LED ${componentId} updated successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: `LED ${componentId} configuration update failed`,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Enviar comando a un LED
   */
  @Post('devices/:deviceUuid/leds/:componentId/command')
  async sendLEDCommand(
    @Param('deviceUuid') deviceUuid: string,
    @Param('componentId') componentId: string,
    @Body() body: { command: LEDCommand },
  ): Promise<{ success: boolean; message: string }> {
    await this.ledService.sendCommand(deviceUuid, componentId, body.command);
    return {
      success: true,
      message: `LED command ${body.command} enqueued successfully`,
    };
  }

  /**
   * Eliminar un periférico
   */
  @Delete('devices/:deviceUuid/peripherals/:componentId')
  async deletePeripheral(
    @Param('deviceUuid') deviceUuid: string,
    @Param('componentId') componentId: string,
  ): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      await this.coordinatorService.deletePeripheral(deviceUuid, componentId);
      return {
        success: true,
        message: `Peripheral ${componentId} deleted successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete peripheral ${componentId}`,
        error: (error as Error).message,
      };
    }
  }
}
