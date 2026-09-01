import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { AuditController } from './audit.controller';

@Global()
@Module({
  providers: [AuditService],
  controllers: [AuditController],
  exports: [AuditService]
})
export class AuditModule {}
