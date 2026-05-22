import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EncryptionService } from './encryption.service';
import { SimpleFinConnectionRepository } from './simplefin-connection.repository';
import { SimpleFinMapService } from './simplefin-map.service';
import { SimpleFinOrchestratorService } from './simplefin-orchestrator.service';
import { SimpleFinService } from './simplefin.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    SimpleFinService,
    SimpleFinMapService,
    SimpleFinOrchestratorService,
    SimpleFinConnectionRepository,
    EncryptionService,
  ],
  exports: [SimpleFinOrchestratorService],
})
export class CashCalendarModule {}
