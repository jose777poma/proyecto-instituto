import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [AuditModule, AuthModule, PassportModule],
  providers: [BookingsService],
  controllers: [BookingsController]
})
export class BookingsModule {}
