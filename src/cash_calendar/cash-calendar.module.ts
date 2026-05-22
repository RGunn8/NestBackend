import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../modules/users/users.module';
import { DatabaseModule } from '../database/database.module';
import { CashAccount } from './entities/cash-account.entity';
import { CashTransaction } from './entities/cash-transaction.entity';
import { EncryptionService } from './encryption.service';
import { SimpleFinConnectionRepository } from './simplefin-connection.repository';
import { SimpleFinMapService } from './simplefin-map.service';
import { SimpleFinOrchestratorService } from './simplefin-orchestrator.service';
import { SimpleFinService } from './simplefin.service';
import { SimpleFinSyncRepository } from './simplefin-sync.repository';

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    TypeOrmModule.forFeature([CashAccount, CashTransaction]),
  ],
  providers: [
    SimpleFinService,
    SimpleFinMapService,
    SimpleFinOrchestratorService,
    SimpleFinConnectionRepository,
    SimpleFinSyncRepository,
    EncryptionService,
  ],
  exports: [SimpleFinOrchestratorService],
})
export class CashCalendarModule {}
