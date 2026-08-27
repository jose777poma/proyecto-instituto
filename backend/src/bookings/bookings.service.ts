import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async joinExistingClass(studentUserId: string, classId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
    });
    if (!student) throw new NotFoundException('Perfil no encontrado');

    const classSession = await this.prisma.classSession.findUnique({
      where: { id: classId },
      include: { _count: { select: { bookings: true } } },
    });

    if (!classSession) throw new NotFoundException('Clase no encontrada');
    if (classSession.status !== 'OPEN') throw new BadRequestException('Esta clase ya no permite inscripciones (Cerrada)');
    if (classSession._count.bookings >= 5) throw new BadRequestException('Esta clase ya alcanzó su cupo máximo de 5 alumnos');

    // Validación 1: Límite diario (1 clase por día)
    const startOfDay = new Date(classSession.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const classesSameDay = await this.prisma.booking.count({
      where: {
        studentId: student.id,
        classSession: { date: { gte: startOfDay, lt: endOfDay } },
        status: { not: 'CANCELED' }
      }
    });

    if (classesSameDay > 0) {
      throw new BadRequestException('Límite excedido: Solo puedes reservar 1 clase por día');
    }

    const booking = await this.prisma.booking.create({
      data: {
        studentId: student.id,
        classId: classSession.id,
        token_used: 'JOIN',
      }
    });

    if (classSession._count.bookings + 1 === 5) {
      await this.prisma.classSession.update({
        where: { id: classId },
        data: { status: 'CLOSED' }
      });
    }

    return booking;
  }

  async createAnchorClass(studentUserId: string, dateString: string, startTime: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
    });
    if (!student) throw new NotFoundException('Perfil no encontrado');

    const targetDate = new Date(dateString);
    let dayOfWeek = targetDate.getDay();
    if (dayOfWeek === 0) dayOfWeek = 7; // Convertimos Domingo (0) a 7 para que concuerde con Lunes (1)

    // 1. Validar límite diario
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const classesSameDay = await this.prisma.booking.count({
      where: {
        studentId: student.id,
        classSession: { date: { gte: startOfDay, lt: endOfDay } },
        status: { not: 'CANCELED' }
      }
    });
    if (classesSameDay > 0) throw new BadRequestException('Límite excedido: Solo puedes tener 1 clase por día');

    // 2. Buscar disponibilidad de profesores en ese día de la semana y a esa hora
    const availableSchedules = await this.prisma.teacherAvailability.findMany({
      where: { day_of_week: dayOfWeek, start_time: startTime },
      include: { teacher: true }
    });

    if (availableSchedules.length === 0) {
      throw new BadRequestException('Lo sentimos, no hay ningún profesor habilitado en ese horario');
    }

    // 3. Filtrar profesores para asegurar que no estén dando OTRA clase en esa misma fecha y hora exacta
    let selectedTeacherId: string | null = null;
    for (const schedule of availableSchedules) {
      const isBusy = await this.prisma.classSession.findFirst({
        where: {
          teacherId: schedule.teacherId,
          date: targetDate,
          start_time: startTime,
          status: { not: 'COMPLETED' }
        }
      });
      if (!isBusy) {
        selectedTeacherId = schedule.teacherId;
        break; // Encontramos al primer profesor completamente libre
      }
    }

    if (!selectedTeacherId) {
      throw new BadRequestException('Todos los profesores están ocupados dando otras clases en esa fecha y hora');
    }

    // 4. Crear la clase (El estudiante es el Ancla) y su reserva consumiendo el Token Ancla
    // Usamos una Transacción SQL para asegurar que ambas cosas se crean o ninguna.
    const result = await this.prisma.$transaction(async (prisma) => {
      const newClass = await prisma.classSession.create({
        data: {
          teacherId: selectedTeacherId,
          date: targetDate,
          start_time: startTime,
          session_type: student.current_session_type,
          anchor_lesson: student.current_lesson,
          status: 'OPEN',
        }
      });

      const newBooking = await prisma.booking.create({
        data: {
          studentId: student.id,
          classId: newClass.id,
          token_used: 'ANCHOR', // Consumimos el token privilegiado
        }
      });

      return { newClass, newBooking };
    });

    return result;
  }

  async cancelBooking(studentUserId: string, bookingId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
    });
    if (!student) throw new NotFoundException('Perfil no encontrado');

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { classSession: true }
    });

    if (!booking) throw new NotFoundException('Reserva no encontrada');
    if (booking.studentId !== student.id) throw new BadRequestException('No puedes cancelar la reserva de otro estudiante');
    if (booking.status !== 'BOOKED') throw new BadRequestException('Esta reserva ya fue procesada o cancelada');

    const { date, start_time } = booking.classSession;
    
    // Parsear la fecha y hora de la clase para comparar
    const classDateTime = new Date(date);
    const [hours, minutes] = start_time.split(':').map(Number);
    classDateTime.setHours(hours, minutes, 0, 0);

    const now = new Date();
    const diffMs = classDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours >= 5) {
      // Cancelación permitida
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELED' }
      });

      // Si la clase estaba llena (CLOSED), la volvemos a abrir
      if (booking.classSession.status === 'CLOSED') {
        await this.prisma.classSession.update({
          where: { id: booking.classSession.id },
          data: { status: 'OPEN' }
        });
      }

      return { message: 'Clase cancelada exitosamente a tiempo. Conservas tu cupo.' };
    } else {
      // Cancelación penalizada
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { 
          status: 'ABSENT_NO_SHOW',
          grade: 0 
        }
      });
      return { message: 'Cancelación tardía (menos de 5 horas). Se ha marcado como Falta Injustificada con nota 0.' };
    }
  }
}
