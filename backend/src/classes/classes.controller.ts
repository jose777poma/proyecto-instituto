import { Controller, Get, Post, UseGuards, Request, Body, Query, Param } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get('available')
  @Roles(Role.STUDENT, Role.SECRETARY, Role.ADMIN)
  getAvailableClasses(@Request() req: any, @Query('studentId') targetStudentId?: string) {
    const studentId = targetStudentId || req.user.userId;
    return this.classesService.getAvailableClassesForStudent(studentId);
  }

  @Get('teacher')
  @Roles(Role.TEACHER)
  getClassesForTeacher(@Request() req: any) {
    const teacherUserId = req.user.userId;
    return this.classesService.getClassesForTeacher(teacherUserId);
  }

  @Get('secretary')
  @Roles(Role.SECRETARY, Role.ADMIN)
  getAllClasses() {
    return this.classesService.getAllClasses();
  }

  @Get('student/:studentUserId/history')
  @Roles(Role.TEACHER, Role.SECRETARY, Role.ADMIN)
  getStudentHistory(@Param('studentUserId') studentUserId: string) {
    return this.classesService.getStudentHistory(studentUserId);
  }
  @Post(':classId/cancel')
  @Roles(Role.ADMIN, Role.SECRETARY)
  cancelClass(@Request() req: any, @Param('classId') classId: string) {
    return this.classesService.cancelClass(classId, req.user.userId, req.user.role);
  }
}
