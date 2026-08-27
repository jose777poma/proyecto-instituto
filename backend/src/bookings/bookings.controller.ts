import { Controller, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('join/:classId')
  @Roles(Role.STUDENT)
  joinClass(@Param('classId') classId: string, @Request() req: any) {
    return this.bookingsService.joinExistingClass(req.user.userId, classId);
  }

  @Post('anchor')
  @Roles(Role.STUDENT)
  createAnchorClass(
    @Request() req: any, 
    @Body('date') date: string, 
    @Body('startTime') startTime: string
  ) {
    return this.bookingsService.createAnchorClass(req.user.userId, date, startTime);
  }

  @Post('cancel/:bookingId')
  @Roles(Role.STUDENT)
  cancelBooking(@Param('bookingId') bookingId: string, @Request() req: any) {
    return this.bookingsService.cancelBooking(req.user.userId, bookingId);
  }
}
