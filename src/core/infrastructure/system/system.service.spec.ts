import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggingService } from '../logging/logging.service';
import { SystemService } from './system.service';

describe('SystemService', () => {
  let service: SystemService;
  const loggingServiceMock: jest.Mocked<Partial<LoggingService>> = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };
  const mockVersion = '3.1.4';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemService,
        {
          provide: LoggingService,
          useValue: loggingServiceMock,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: unknown) => {
                if (key === 'APP_VERSION') {
                  return mockVersion;
                }
                return defaultValue;
              }),
          },
        },
      ],
    }).compile();

    service = module.get<SystemService>(SystemService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should report system health with environment version', () => {
    const result = service.getHealthStatus();

    expect(result).toEqual({
      system_online: true,
      system_db_connection_check: true,
      system_version: mockVersion,
    });
  });
});
