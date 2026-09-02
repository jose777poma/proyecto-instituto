import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async getAvailableClassesForStudent(studentUserId: string) {
    // 1. Obtener el perfil del estudiante
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
    });

    if (!student) {
      throw new NotFoundException('Perfil de estudiante no encontrado');
    }

    const { current_lesson, current_session_type } = student;

    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // 2. Buscar clases que cumplan con la regla de Matchmaking
    const availableClasses = await this.prisma.classSession.findMany({
      where: {
        status: 'OPEN',
        date: { gte: today },
        session_type: current_session_type, // Regla 1: Homogeneidad de sesión
        bookings: {
          none: {
            studentId: student.id,
            status: { not: 'CANCELED' }
          }
        },
        OR: [
          {
            anchor_lesson: {
              gte: Math.max(1, current_lesson - 2),
              lte: Math.min(30, current_lesson + 2),
            }
          },
          {
            anchor_lesson: {
              gte: Math.max(31, current_lesson - 3),
              lte: Math.min(50, current_lesson + 3),
            }
          }
        ],
      },
      include: {
        teacher: {
          include: { user: { select: { name: true } } }
        },
        _count: {
          select: { 
            bookings: {
              where: { status: { not: 'CANCELED' } }
            } 
          }
        }
      },
      orderBy: { date: 'asc' }
    });

    // 3. Filtrar en memoria las que ya llegaron al límite máximo de 5 alumnos,
    // o que si son de hoy, ya hayan empezado.
    return availableClasses
      .filter(c => c._count.bookings < 5)
      .filter(c => {
        const classDate = new Date(c.date);
        if (classDate.getUTCFullYear() === today.getUTCFullYear() && classDate.getUTCMonth() === today.getUTCMonth() && classDate.getUTCDate() === today.getUTCDate()) {
          const [hours, minutes] = c.start_time.split(':').map(Number);
          const classTime = new Date();
          classTime.setHours(hours, minutes, 0, 0);
          if (classTime.getTime() <= now.getTime()) {
            return false;
          }
        }
        return true;
      })
      .map(c => ({
        id: c.id,
        date: c.date,
        start_time: c.start_time,
        session_type: c.session_type,
        anchor_lesson: c.anchor_lesson,
        teacher_name: c.teacher.user.name,
        available_spots: 5 - c._count.bookings
      }));
  }

  async getClassesForTeacher(teacherUserId: string) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
      include: {
        classes: {
          include: {
            _count: {
              select: { 
                bookings: { where: { status: { not: 'CANCELED' } } } 
              }
            },
            bookings: {
              include: {
                student: { include: { user: true } }
              }
            }
          },
          orderBy: [
            { date: 'asc' },
            { start_time: 'asc' }
          ]
        }
      }
    });

    if (!teacherProfile) throw new NotFoundException('Perfil de profesor no encontrado');

    return teacherProfile.classes.map(c => ({
      id: c.id,
      date: c.date,
      start_time: c.start_time,
      session_type: c.session_type,
      anchor_lesson: c.anchor_lesson,
      status: c.status,
      bookings_count: c._count.bookings,
      bookings: c.bookings.map(b => ({
        id: b.id,
        status: b.status,
        grade: b.grade,
        observations: b.observations,
        student: {
          id: b.student.id,
          userId: b.student.userId,
          name: b.student.user.name,
          email: b.student.user.email,
          birth_date: b.student.birth_date
        }
      }))
    }));
  }

  async getStudentHistory(studentUserId: string) {
    const studentProfile = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId }
    });
    if (!studentProfile) throw new NotFoundException('Estudiante no encontrado');

    const bookings = await this.prisma.booking.findMany({
      where: {
        studentId: studentProfile.id,
        status: { in: ['ATTENDED', 'ABSENT_NO_SHOW'] }
      },
      include: {
        classSession: {
          include: {
            teacher: { include: { user: true } }
          }
        }
      },
      orderBy: {
        classSession: { date: 'desc' }
      }
    });

    return bookings.map(b => ({
      id: b.id,
      status: b.status,
      grade: b.grade,
      observations: b.observations,
      date: b.classSession.date,
      start_time: b.classSession.start_time,
      session_type: b.classSession.session_type,
      anchor_lesson: b.classSession.anchor_lesson,
      teacher_name: b.classSession.teacher.user.name
    }));
  }

  async getAllClasses() {
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    const classes = await this.prisma.classSession.findMany({
      where: {
        date: { gte: today },
        status: { not: 'CANCELED' }
      },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
        _count: {
          select: {
            bookings: {
              where: { status: { not: 'CANCELED' } }
            }
          }
        },
        bookings: {
          where: { status: { not: 'CANCELED' } },
          include: { student: { include: { user: { select: { name: true, email: true } } } } }
        }
      },
      orderBy: [
        { date: 'asc' },
        { start_time: 'asc' }
      ]
    });

    return classes.map(c => ({
      id: c.id,
      date: c.date,
      start_time: c.start_time,
      session_type: c.session_type,
      anchor_lesson: c.anchor_lesson,
      status: c.status,
      teacher_name: c.teacher.user.name,
      bookings_count: c._count.bookings,
      bookings: c.bookings.map(b => ({
        id: b.id,
        student_user_id: b.student.userId,
        student_name: b.student.user.name,
        student_email: b.student.user.email,
        student_birth_date: b.student.birth_date,
        status: b.status
      }))
    }));
  }


  async cancelClass(classId: string, actorId: string, actorRole: Role) {
    const classSession = await this.prisma.classSession.findUnique({
      where: { id: classId },
      include: { bookings: { where: { status: { not: 'CANCELED' } } } }
    });

    if (!classSession) throw new NotFoundException('Clase no encontrada');

    return this.prisma.$transaction(async (prisma) => {
      // 1. Cancelar todas las reservas (esto devuelve "conceptualmente" el token/cupo a los alumnos
      // y en el historial les aparecerá que la reserva fue cancelada).
      if (classSession.bookings.length > 0) {
        await prisma.booking.updateMany({
          where: { classId: classId },
          data: { status: 'CANCELED' }
        });
        
        // Simulación de envío de correo
        console.log(`[SIMULACIÓN EMAIL] Se enviaron correos a los alumnos informando la cancelación de la clase del ${classSession.date.toISOString()} a las ${classSession.start_time}`);
      }

      // 2. Marcar la clase como cancelada
      await prisma.classSession.update({
        where: { id: classId },
        data: { status: 'CANCELED' }
      });

      // 3. Auditoría
      await prisma.auditLog.create({
        data: {
          actorId,
          actorRole,
          action: 'CANCEL_CLASS',
          entityType: 'ClassSession',
          entityId: classId,
          details: `Clase cancelada por enfermedad/permiso. Se cancelaron ${classSession.bookings.length} reservas.`
        }
      });

      return { message: 'Clase y reservas canceladas exitosamente' };
    });
  }
}
