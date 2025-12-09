import { Controller, Get, Res, Sse } from '@nestjs/common';
import type { Response } from 'express';
import { startWith, switchMap } from 'rxjs';
import { DeviceService } from '../device/device.service';
import { LoggingService } from '../logging/logging.service';
import { DashboardService } from './dashboard.service';
import type { DashboardStatus } from './dashboard.types';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly deviceService: DeviceService,
    private readonly loggingService: LoggingService,
  ) {}

  @Get()
  async getDashboard(@Res() res: Response): Promise<void> {
    const context = 'DashboardController.getDashboard';
    this.loggingService.debug('Handling GET /dashboard', context);

    try {
      const status = await this.dashboardService.getDashboardStatus();
      const html = this.generateHTML(status);

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      this.loggingService.error(
        'Error generating dashboard',
        error instanceof Error ? error.stack : String(error),
        context,
      );
      res.status(500).send('<h1>Error loading dashboard</h1>');
    }
  }

  private generateHTML(status: DashboardStatus): string {
    const formatDate = (date: Date | null): string => {
      if (!date) return 'Never';
      return new Date(date).toLocaleString();
    };

    const getStatusBadge = (connected: boolean): string => {
      if (connected) {
        return '<span class="badge badge-success">Connected</span>';
      }
      return '<span class="badge badge-error">Disconnected</span>';
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CNC Granel - Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            background: white;
            border-radius: 10px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .header h1 {
            color: #333;
            font-size: 2em;
            margin-bottom: 5px;
        }
        
        .header p {
            color: #666;
            font-size: 1.1em;
        }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 20px;
        }
        
        @media (max-width: 1200px) {
            .grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        
        @media (max-width: 768px) {
            .grid {
                grid-template-columns: 1fr;
            }
        }
        
        .card {
            background: white;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .card h2 {
            color: #333;
            font-size: 1.3em;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .card-icon {
            font-size: 1.5em;
        }
        
        .status-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
        }
        
        .status-item:last-child {
            border-bottom: none;
        }
        
        .status-label {
            color: #666;
            font-weight: 500;
        }
        
        .badge {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
        }
        
        .badge-success {
            background: #10b981;
            color: white;
        }
        
        .badge-error {
            background: #ef4444;
            color: white;
        }
        
        .error-message {
            color: #ef4444;
            font-size: 0.9em;
            margin-top: 5px;
        }
        
        .devices-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        
        .devices-table th,
        .devices-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        
        .devices-table th {
            background: #f9fafb;
            font-weight: 600;
            color: #333;
        }
        
        .devices-table tr:hover {
            background: #f9fafb;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #999;
        }
        
        .empty-state-icon {
            font-size: 3em;
            margin-bottom: 10px;
        }
        
        .refresh-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: white;
            border: none;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            font-size: 1.5em;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s;
        }
        
        .refresh-btn:hover {
            transform: rotate(180deg);
            }
            
            .header h1 {
                font-size: 1.5em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔧 CNC Granel Dashboard</h1>
            <p>System Status & Monitoring</p>
        </div>
        
        <div class="grid">
            <div class="card">
                <h2>
                    <span class="card-icon">🖥️</span>
                    Server Status
                </h2>
                <div class="status-item">
                    <span class="status-label">Status</span>
                    ${getStatusBadge(status.server.online)}
                </div>
                <div class="status-item">
                    <span class="status-label">Version</span>
                    <strong>${status.server.version}</strong>
                </div>
            </div>
            
            <div class="card">
                <h2>
                    <span class="card-icon">🗄️</span>
                    Database
                </h2>
                <div class="status-item">
                    <span class="status-label">Status</span>
                    ${getStatusBadge(status.database.connected)}
                </div>
                ${status.database.name ? `<div class="status-item"><span class="status-label">Database</span><strong>${status.database.name}</strong></div>` : ''}
                ${status.database.host ? `<div class="status-item"><span class="status-label">Host</span><code>${status.database.host}${status.database.port ? `:${status.database.port}` : ''}</code></div>` : ''}
                ${status.database.error ? `<div class="error-message">${status.database.error}</div>` : ''}
            </div>
            
            <div class="card">
                <h2>
                    <span class="card-icon">⚡</span>
                    Redis
                </h2>
                <div class="status-item">
                    <span class="status-label">Status</span>
                    ${getStatusBadge(status.redis.connected)}
                </div>
                ${status.redis.host ? `<div class="status-item"><span class="status-label">Host</span><code>${status.redis.host}:${status.redis.port || 6379}</code></div>` : ''}
                ${status.redis.error ? `<div class="error-message">${status.redis.error}</div>` : ''}
            </div>
            
            <div class="card">
                <h2>
                    <span class="card-icon">📡</span>
                    MQTT Broker
                </h2>
                <div class="status-item">
                    <span class="status-label">Status</span>
                    ${getStatusBadge(status.mqtt.connected)}
                </div>
                ${status.mqtt.host ? `<div class="status-item"><span class="status-label">Host</span><code>${status.mqtt.host}:${status.mqtt.port || 1883}${status.mqtt.useTls ? ' (TLS)' : ''}</code></div>` : ''}
                ${status.mqtt.error ? `<div class="error-message">${status.mqtt.error}</div>` : ''}
            </div>
        </div>
        
        <div class="card">
            <h2>
                <span class="card-icon">📱</span>
                Connected Devices
            </h2>
            <div class="status-item">
                <span class="status-label">Connected</span>
                <strong>${status.devices.connected} / ${status.devices.total}</strong>
            </div>
            
            ${
              status.devices.list.length > 0
                ? `
                <table class="devices-table">
                    <thead>
                        <tr>
                            <th>UUID</th>
                            <th>IP</th>
                            <th>Status</th>
                            <th>Last Seen</th>
                        </tr>
                    </thead>
                    <tbody id="devices-tbody">
                        ${status.devices.list
                          .map(
                            (device: any) => `
                            <tr>
                                <td><code>${device.uuid}</code></td>
                                <td>${device.ip || 'N/A'}</td>
                                <td>${getStatusBadge(device.status === 'online')}</td>
                                <td>${formatDate(device.lastSeen)}</td>
                            </tr>
                        `,
                          )
                          .join('')}
                    </tbody>
                </table>
            `
                : `
                <div class="empty-state" id="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <p>No devices connected</p>
                </div>
            `
            }
        </div>
    </div>
    
    <button class="refresh-btn" onclick="location.reload()" title="Refresh">
        🔄
    </button>
    
    <script>
        // Conectar a Server-Sent Events para actualizaciones en tiempo real
        const eventSource = new EventSource('/dashboard/events');
        const devicesCard = document.querySelector('.card:last-child');
        const statusItem = devicesCard?.querySelector('.status-item');
        
        eventSource.onmessage = function(event) {
            const data = JSON.parse(event.data);
            
            if (data.type === 'device_update') {
                updateDevicesList(data.devices, data.stats);
            }
        };
        
        eventSource.onerror = function(error) {
            console.error('SSE error:', error);
            // Intentar reconectar después de 5 segundos
            setTimeout(() => {
                eventSource.close();
                location.reload();
            }, 5000);
        };
        
        function updateDevicesList(devices, stats) {
            // Actualizar contador
            if (statusItem) {
                statusItem.innerHTML = \`
                    <span class="status-label">Connected</span>
                    <strong>\${stats.connected} / \${stats.total}</strong>
                \`;
            }
            
            const formatDate = (dateStr) => {
                if (!dateStr) return 'Never';
                return new Date(dateStr).toLocaleString();
            };
            
            const getStatusBadge = (connected) => {
                if (connected) {
                    return '<span class="badge badge-success">Connected</span>';
                }
                return '<span class="badge badge-error">Disconnected</span>';
            };
            
            const tbody = document.getElementById('devices-tbody');
            const emptyState = document.getElementById('empty-state');
            
            if (devices.length > 0) {
                if (emptyState) emptyState.remove();
                if (!tbody) {
                    // Crear tabla si no existe
                    const card = devicesCard;
                    const table = document.createElement('table');
                    table.className = 'devices-table';
                    table.innerHTML = \`
                        <thead>
                            <tr>
                                <th>UUID</th>
                                <th>IP</th>
                                <th>Status</th>
                                <th>Last Seen</th>
                            </tr>
                        </thead>
                        <tbody id="devices-tbody"></tbody>
                    \`;
                    card.appendChild(table);
                }
                
                const newTbody = document.getElementById('devices-tbody');
                if (newTbody) {
                    newTbody.innerHTML = devices.map(device => \`
                        <tr>
                            <td><code>\${device.uuid}</code></td>
                            <td>\${device.ip || 'N/A'}</td>
                            <td>\${getStatusBadge(device.status === 'online')}</td>
                            <td>\${formatDate(device.lastSeen)}</td>
                        </tr>
                    \`).join('');
                }
            } else {
                if (tbody) {
                    tbody.closest('table')?.remove();
                }
                if (!emptyState && devicesCard) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'empty-state';
                    emptyDiv.id = 'empty-state';
                    emptyDiv.innerHTML = \`
                        <div class="empty-state-icon">📭</div>
                        <p>No devices connected</p>
                    \`;
                    devicesCard.appendChild(emptyDiv);
                }
            }
        }
    </script>
</body>
</html>
    `;
  }

  @Sse('events')
  async sse(): Promise<any> {
    const context = 'DashboardController.sse';
    this.loggingService.log('SSE connection established', context);

    // Escuchar actualizaciones de dispositivos en tiempo real
    const deviceUpdates$ = this.deviceService.getDeviceUpdates();

    // Enviar estado inicial inmediatamente
    const initialDevices = await this.deviceService.getDevices();
    this.loggingService.log(
      `SSE connection established with ${initialDevices.length} existing devices`,
      context,
    );

    return deviceUpdates$.pipe(
      startWith({ type: 'initial', device: null } as any), // Enviar estado inicial primero
      switchMap(async (update) => {
        const devices = await this.deviceService.getDevices();
        return {
          data: JSON.stringify({
            type: 'device_update',
            update,
            devices: devices.map((d) => ({
              uuid: d.uuid,
              status: d.status,
              lastSeen: d.lastSeen,
              ip: d.ip,
            })),
            stats: {
              connected: devices.filter((d) => d.status === 'online').length,
              total: devices.length,
            },
          }),
        };
      }),
    );
  }
}
