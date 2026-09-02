import { Controller, Get, Request, Query, UseGuards, Post, Put, Param, Body, NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

import * as bcrypt from 'bcrypt';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('search')
  @Roles(Role.SECRETARY, Role.ADMIN)
  async searchStudents(@Query('q') query: string) {
    if (!query) return [];
    
    return this.prisma.user.findMany({
      where: {
        role: 'STUDENT',
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        studentProfile: {
          select: {
            id: true,
            birth_date: true,
            current_lesson: true,
            current_session_type: true,
            access_expires_at: true
          }
        }
      },
      take: 10
    });
  }

  @Post('staff')
  @Roles(Role.ADMIN)
  async createStaff(@Request() req: any, @Body() data: any) {
    const { name, email, password, role } = data;
    if (role !== 'SECRETARY' && role !== 'ADMIN') {
      throw new BadRequestException('Rol inválido');
    }
    
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException('El correo ya está en uso');

    const password_hash = await bcrypt.hash(password || 'admin', 10);

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        role: role as Role,
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: `CREATE_${role}`,
        entityType: 'User',
        entityId: user.id,
        details: `Se creó personal: ${name} (${email}) con rol ${role}`
      }
    });

    return { message: 'Personal creado exitosamente', staff: { name, email, role } };
  }

  @Get('staff')
  @Roles(Role.ADMIN)
  async getStaff() {
    return this.prisma.user.findMany({
      where: {
        role: {
          in: ['SECRETARY', 'ADMIN']
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
  }

  @Post('teacher')
  @Roles(Role.ADMIN)
  async createTeacher(@Request() req: any, @Body() data: any) {
    const { name, email, password } = data;
    
    const password_hash = await bcrypt.hash(password || 'admin', 10);

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        role: 'TEACHER',
        teacherProfile: {
          create: {
            active: true
          }
        }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: 'CREATE_TEACHER',
        entityType: 'User',
        entityId: user.id,
        details: `Se creó al profesor: ${name} (${email})`
      }
    });

    return { message: 'Profesor creado exitosamente', teacher: { name, email } };
  }

  @Get('teachers/:teacherId/availability')
  @Roles(Role.ADMIN, Role.SECRETARY)
  async getTeacherAvailability(@Param('teacherId') teacherId: string) {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherId },
      include: { availability: true }
    });
    return profile?.availability || [];
  }

  @Post('teachers/:teacherId/availability')
  @Roles(Role.ADMIN, Role.SECRETARY)
  async setTeacherAvailability(
    @Request() req: any,
    @Param('teacherId') teacherId: string,
    @Body() data: { schedules: { day_of_week: number, start_time: string }[] }
  ) {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherId }
    });

    if (!profile) throw new NotFoundException('Profesor no encontrado');

    return this.prisma.$transaction(async (prisma) => {
      // Borrar anteriores
      await prisma.teacherAvailability.deleteMany({
        where: { teacherId: profile.id }
      });

      // Insertar nuevos
      if (data.schedules && data.schedules.length > 0) {
        await prisma.teacherAvailability.createMany({
          data: data.schedules.map(s => ({
            teacherId: profile.id,
            day_of_week: s.day_of_week,
            start_time: s.start_time
          }))
        });
      }

      await prisma.auditLog.create({
        data: {
          actorId: req.user.userId,
          actorRole: req.user.role,
          action: 'UPDATE_TEACHER_SCHEDULE',
          entityType: 'TeacherProfile',
          entityId: profile.id,
          details: `Actualizó el horario de disponibilidad del profesor`
        }
      });

      return { message: 'Horario actualizado exitosamente' };
    });
  }

  @Get('exceptions')
  @Roles(Role.ADMIN, Role.SECRETARY)
  async getExceptions() {
    return this.prisma.teacherException.findMany({
      include: {
        teacher: { include: { user: true } }
      },
      orderBy: { date: 'asc' }
    });
  }

  @Post('exceptions')
  @Roles(Role.ADMIN, Role.SECRETARY)
  async createException(@Request() req: any, @Body() body: { date: string, teacherId: string | null, description: string }) {
    const { date, teacherId, description } = body;
    const targetDate = new Date(date);
    targetDate.setUTCHours(0, 0, 0, 0);

    const exception = await this.prisma.teacherException.create({
      data: {
        date: targetDate,
        teacherId: teacherId || null,
        description
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: 'CREATE_EXCEPTION',
        entityType: 'TeacherException',
        entityId: exception.id,
        details: `Se creó una excepción/feriado para el ${targetDate.toISOString()} - ${description}`
      }
    });

    return { message: 'Excepción creada', exception };
  }

  @Post('exceptions/:id/delete')
  @Roles(Role.ADMIN, Role.SECRETARY)
  async deleteException(@Request() req: any, @Param('id') id: string) {
    await this.prisma.teacherException.delete({ where: { id } });
    
    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: 'DELETE_EXCEPTION',
        entityType: 'TeacherException',
        entityId: id,
        details: `Se eliminó la excepción/feriado`
      }
    });
    
    return { message: 'Excepción eliminada' };
  }

  @Post('student')
  @Roles(Role.SECRETARY, Role.ADMIN)
  async createStudent(@Request() req: any, @Body() data: any) {
    const { name, email, password, birth_date, current_lesson, current_session_type, months_access } = data;
    
    // Validación de exámenes
    const EXAM_MILESTONES = [5, 10, 15, 20, 25, 30, 40, 50];
    if (current_session_type === 'EXAM_WRITTEN' || current_session_type === 'EXAM_ORAL') {
      if (!EXAM_MILESTONES.includes(Number(current_lesson))) {
        throw new BadRequestException(`No se puede asignar un examen a la lección ${current_lesson}. Los exámenes solo están permitidos en las lecciones: ${EXAM_MILESTONES.join(', ')}.`);
      }
    }
    // Calcular vencimiento
    const access_expires_at = new Date();
    access_expires_at.setMonth(access_expires_at.getMonth() + Number(months_access || 1));
    
    const password_hash = await bcrypt.hash(password || 'admin', 10);

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        role: 'STUDENT',
        studentProfile: {
          create: {
            birth_date: birth_date ? new Date(birth_date) : null,
            current_lesson: Number(current_lesson) || 1,
            current_session_type: current_session_type || 'ESSENTIAL',
            access_expires_at
          }
        }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: 'CREATE_STUDENT',
        entityType: 'User',
        entityId: user.id,
        details: `Se registró al alumno: ${name} en lección ${current_lesson} (${current_session_type}) con ${months_access} meses de acceso`
      }
    });

    return { message: 'Alumno creado exitosamente', student: { name, email } };
  }

  @Get('teachers')
  @Roles(Role.ADMIN, Role.SECRETARY)
  async getTeachers() {
    return this.prisma.user.findMany({
      where: { role: 'TEACHER' },
      include: { teacherProfile: true }
    });
  }

  @Put('teachers/:teacherUserId/exams-permission')
  @Roles(Role.ADMIN, Role.SECRETARY)
  async toggleExamPermission(
    @Request() req: any,
    @Param('teacherUserId') teacherUserId: string,
    @Body('can_conduct_exams') can_conduct_exams: boolean
  ) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
      include: { user: true }
    });

    if (!teacherProfile) throw new NotFoundException('Profesor no encontrado');

    await this.prisma.teacherProfile.update({
      where: { userId: teacherUserId },
      data: { can_conduct_exams }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: 'UPDATE_TEACHER_PERMISSION',
        entityType: 'TeacherProfile',
        entityId: teacherProfile.id,
        details: `Se ${can_conduct_exams ? 'habilitó' : 'deshabilitó'} el permiso de tomar exámenes para el profesor ${teacherProfile.user.name}`
      }
    });

    return { message: 'Permiso actualizado correctamente' };
  }

  @Post(':studentUserId/extend')
  @Roles(Role.ADMIN)
  async extendAccess(
    @Request() req: any,
    @Param('studentUserId') studentUserId: string,
    @Body('months') months: number
  ) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId }
    });
    
    if (!student) {
      throw new Error('Student not found');
    }

    const now = new Date();
    const currentExpiry = new Date(student.access_expires_at);
    
    // Si ya venció hace mucho, empezamos a contar desde HOY. Si aún tiene tiempo, sumamos al tiempo restante.
    const baseDate = currentExpiry > now ? currentExpiry : now;
    
    // Añadir meses
    const newExpiry = new Date(baseDate);
    newExpiry.setMonth(newExpiry.getMonth() + Number(months));

    await this.prisma.studentProfile.update({
      where: { userId: studentUserId },
      data: { access_expires_at: newExpiry }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: 'PAYMENT_EXTENSION',
        entityType: 'StudentProfile',
        entityId: student.id,
        details: `Se extendió el acceso por ${months} meses. Nueva fecha: ${newExpiry.toISOString()}`
      }
    });

    return { message: 'Acceso extendido exitosamente', newExpiry };
  }

  @Post(':studentUserId/level')
  @Roles(Role.ADMIN, Role.SECRETARY)
  async updateStudentLevel(
    @Request() req: any,
    @Param('studentUserId') studentUserId: string,
    @Body() body: { current_lesson: number, current_session_type: string }
  ) {
    const { current_lesson, current_session_type } = body;
    
    // Validación de exámenes
    const EXAM_MILESTONES = [5, 10, 15, 20, 25, 30, 40, 50];
    if (current_session_type === 'EXAM_WRITTEN' || current_session_type === 'EXAM_ORAL') {
      if (!EXAM_MILESTONES.includes(Number(current_lesson))) {
        throw new BadRequestException(`No se puede asignar un examen a la lección ${current_lesson}. Los exámenes solo están permitidos en las lecciones: ${EXAM_MILESTONES.join(', ')}.`);
      }
    }
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
      include: { user: true }
    });
    
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    const oldLesson = student.current_lesson;
    const oldSessionType = student.current_session_type;

    await this.prisma.studentProfile.update({
      where: { userId: studentUserId },
      data: {
        current_lesson,
        current_session_type: current_session_type as any
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: 'UPDATE_LEVEL',
        entityType: 'StudentProfile',
        entityId: student.id,
        details: `Se cambió de Lección ${oldLesson} (${oldSessionType}) ➔ Lección ${current_lesson} (${current_session_type}) de ${student.user.name}`
      }
    });

    return { message: 'Nivel actualizado exitosamente' };
  }

  @Get('me')
  async getProfile(@Request() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        studentProfile: {
          include: {
            weeklyQuotas: true
          }
        },
        teacherProfile: true,
      }
    });
    
    // Remueve el hash de la contraseña por seguridad
    if (user) {
      delete (user as any).password_hash;
    }
    
    return user;
  }

  @Get('me/exceptions')
  @Roles(Role.TEACHER)
  async getMyExceptions(@Request() req: any) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId: req.user.userId }
    });
    if (!teacherProfile) throw new NotFoundException('Perfil no encontrado');

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));

    return this.prisma.teacherException.findMany({
      where: {
        date: { gte: today },
        OR: [
          { teacherId: null },
          { teacherId: teacherProfile.id }
        ]
      },
      orderBy: { date: 'asc' }
    });
  }

  @Post('me/meet-link')
  @Roles(Role.TEACHER)
  async updateMeetLink(@Request() req: any, @Body('meet_link') meet_link: string) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { userId: req.user.userId }
    });

    if (!teacher) {
      throw new Error('Perfil de profesor no encontrado');
    }

    await this.prisma.teacherProfile.update({
      where: { id: teacher.id },
      data: { meet_link }
    });

    return { message: 'Link de Google Meet actualizado' };
  }

  @Get('me/history')
  async getHistory(@Request() req: any) {
    // Si es estudiante, traemos su historial
    if (req.user.role === 'STUDENT') {
      const student = await this.prisma.studentProfile.findUnique({
        where: { userId: req.user.userId },
      });
      if (!student) return [];
      
      const bookings = await this.prisma.booking.findMany({
        where: { studentId: student.id },
        include: {
          classSession: {
            include: {
              teacher: {
                include: { user: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return bookings;
    }
    return [];
  }
}
