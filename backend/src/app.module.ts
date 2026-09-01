import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ClassesModule } from './classes/classes.module';
import { BookingsModule } from './bookings/bookings.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, ClassesModule, BookingsModule, AuditModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
