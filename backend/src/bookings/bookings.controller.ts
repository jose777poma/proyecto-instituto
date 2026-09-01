import { Controller, Post, Body, Param, UseGuards, Request, Get, Query } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('book')
  @Roles(Role.STUDENT, Role.SECRETARY, Role.ADMIN)
  bookClass(
    @Request() req: any,
    @Body('date') date: string,
    @Body('startTime') startTime: string,
    @Body('teacherId') teacherId?: string,
    @Body('studentId') targetStudentId?: string // Opcional, usado si quien llama no es el estudiante
  ) {
    const actorId = req.user.userId;
    const actorRole = req.user.role;
    // Si no se envía targetStudentId (ej. un estudiante reservando para sí mismo), se usa el actorId
    const studentIdToBook = targetStudentId || actorId;
    
    return this.bookingsService.bookSmartClass(studentIdToBook, actorId, actorRole, date, startTime, teacherId);
  }

  @Get('available-teachers')
  @Roles(Role.STUDENT, Role.SECRETARY, Role.ADMIN)
  getAvailableTeachers(
    @Request() req: any,
    @Query('date') date: string,
    @Query('startTime') startTime: string,
    @Query('studentId') targetStudentId?: string
  ) {
    const studentIdToLookFor = targetStudentId || req.user.userId;
    return this.bookingsService.getAvailableTeachers(date, startTime, studentIdToLookFor);
  }

  @Post('force-book')
  @Roles(Role.SECRETARY, Role.ADMIN)
  forceBookClass(@Request() req: any, @Body() body: { studentUserId: string, classId: string }) {
    return this.bookingsService.forceBookClass(body.studentUserId, body.classId, req.user.role);
  }

  @Post('force-create-anchor')
  @Roles(Role.SECRETARY, Role.ADMIN)
  forceCreateAnchorClass(@Request() req: any, @Body() body: { studentUserId: string, teacherId: string, date: string, startTime: string }) {
    return this.bookingsService.forceCreateAnchorClass(body.studentUserId, body.teacherId, body.date, body.startTime, req.user.role);
  }

  @Post('cancel/:bookingId')
  @Roles(Role.STUDENT, Role.SECRETARY, Role.ADMIN)
  cancelBooking(
    @Request() req: any,
    @Param('bookingId') bookingId: string,
    @Body('studentId') targetStudentId?: string
  ) {
    const actorId = req.user.userId;
    const actorRole = req.user.role;
    const studentIdToCancel = targetStudentId || actorId;
    return this.bookingsService.cancelBooking(studentIdToCancel, actorId, actorRole, bookingId);
  }

  @Post('grade/:bookingId')
  @Roles(Role.TEACHER, Role.SECRETARY, Role.ADMIN)
  gradeBooking(
    @Request() req: any,
    @Param('bookingId') bookingId: string,
    @Body('grade') grade: number,
    @Body('observations') observations?: string
  ) {
    const actorId = req.user.userId;
    const actorRole = req.user.role;
    return this.bookingsService.gradeBooking(actorId, actorRole, bookingId, grade, observations);
  }

  @Post('absent/:bookingId')
  @Roles(Role.TEACHER, Role.SECRETARY, Role.ADMIN)
  markAbsent(
    @Request() req: any,
    @Param('bookingId') bookingId: string
  ) {
    const actorId = req.user.userId;
    const actorRole = req.user.role;
    return this.bookingsService.markAbsent(actorId, actorRole, bookingId);
  }
}
