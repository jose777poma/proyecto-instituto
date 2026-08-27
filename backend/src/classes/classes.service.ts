import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

    // 2. Buscar clases que cumplan con la regla de Matchmaking
    const availableClasses = await this.prisma.classSession.findMany({
      where: {
        status: 'OPEN',
        session_type: current_session_type, // Regla 1: Homogeneidad de sesión
        anchor_lesson: {
          gte: Math.max(1, current_lesson - 3), // Regla 2: Límite inferior (-3)
          lte: Math.min(50, current_lesson + 3), // Regla 2: Límite superior (+3)
        },
      },
      include: {
        teacher: {
          include: { user: { select: { name: true } } }
        },
        _count: {
          select: { bookings: true }
        }
      },
      orderBy: { date: 'asc' }
    });

    // 3. Filtrar en memoria las que ya llegaron al límite máximo de 5 alumnos
    // y dar formato de salida limpio al Frontend.
    return availableClasses
      .filter(c => c._count.bookings < 5)
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
}
