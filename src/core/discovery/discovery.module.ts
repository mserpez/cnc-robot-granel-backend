import { Module } from '@nestjs/common';
import { UdpDiscoveryService } from './udp-discovery.service';

@Module({
  providers: [UdpDiscoveryService],
  exports: [UdpDiscoveryService],
})
export class DiscoveryModule {}

