/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { LoggingService } from '../../core';
import { HARDWARE_USB_TRANSPORT } from './hardware-communication.constants';
import { HardwareCommunicationService } from './hardware-communication.service';
import type {
  UsbInboundMessage,
  UsbTransport,
} from './hardware-communication.types';

const createLoggingMock = (): jest.Mocked<Partial<LoggingService>> => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
});

const createUsbTransportMock = (): jest.Mocked<UsbTransport> => ({
  isOpen: jest.fn(),
  open: jest.fn(),
  close: jest.fn(),
  write: jest.fn(),
  read: jest.fn(),
});

describe('HardwareCommunicationService', () => {
  let service: HardwareCommunicationService;
  let usbTransport: jest.Mocked<UsbTransport>;
  let loggingServiceMock: jest.Mocked<Partial<LoggingService>>;

  beforeEach(async () => {
    usbTransport = createUsbTransportMock();
    loggingServiceMock = createLoggingMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HardwareCommunicationService,
        {
          provide: LoggingService,
          useValue: loggingServiceMock,
        },
        {
          provide: HARDWARE_USB_TRANSPORT,
          useValue: usbTransport,
        },
      ],
    }).compile();

    service = module.get<HardwareCommunicationService>(
      HardwareCommunicationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should open the transport when needed and return the USB response', async () => {
    usbTransport.isOpen.mockReturnValueOnce(false).mockReturnValue(true);
    usbTransport.open.mockResolvedValue(undefined);
    usbTransport.write.mockResolvedValue(undefined);
    const response: UsbInboundMessage = { status: 'ok', data: { ready: true } };
    usbTransport.read.mockResolvedValue(response);

    const result = await service.sendCommand('PING');

    expect(usbTransport.open).toHaveBeenCalledTimes(1);
    expect(usbTransport.write).toHaveBeenCalledWith({
      command: 'PING',
      payload: {},
    });
    expect(usbTransport.read).toHaveBeenCalledTimes(1);
    expect(result).toEqual(response);
  });

  it('should use the existing transport session when already open', async () => {
    usbTransport.isOpen.mockReturnValue(true);
    usbTransport.open.mockResolvedValue(undefined);
    usbTransport.write.mockResolvedValue(undefined);
    const response: UsbInboundMessage = { status: 'ok' };
    usbTransport.read.mockResolvedValue(response);

    await service.sendCommand('STATUS', { check: true });

    expect(usbTransport.open).not.toHaveBeenCalled();
    expect(usbTransport.write).toHaveBeenCalledWith({
      command: 'STATUS',
      payload: { check: true },
    });
  });

  it('should propagate transport errors and log them', async () => {
    usbTransport.isOpen.mockReturnValue(true);
    const failure = new Error('write-failed');
    usbTransport.write.mockRejectedValue(failure);

    await expect(service.sendCommand('PING')).rejects.toThrow(failure);
    expect(loggingServiceMock.error).toHaveBeenCalledWith(
      'Failed to send command PING',
      failure.stack,
      'HardwareCommunicationService.sendCommand',
    );
    expect(usbTransport.read).not.toHaveBeenCalled();
  });

  it('should fall back to mock responses when no USB transport is configured', async () => {
    const isolatedModule: TestingModule = await Test.createTestingModule({
      providers: [
        HardwareCommunicationService,
        {
          provide: LoggingService,
          useValue: createLoggingMock(),
        },
      ],
    }).compile();

    const isolatedService = isolatedModule.get<HardwareCommunicationService>(
      HardwareCommunicationService,
    );

    const response = await isolatedService.sendCommand('PING');

    expect(response.status).toBe('ok');
  });
});
