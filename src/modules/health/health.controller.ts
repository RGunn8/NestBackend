import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller()
export class HealthController {
  @Get()
  root() {
    return {
      status: 'ok',
      service: 'nestjs-app',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
