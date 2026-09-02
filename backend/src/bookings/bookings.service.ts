import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async bookSmartClass(
    studentUserId: string, 
    actorId: string, 
    actorRole: Role, 
    dateString: string, 
    startTime: string, 
    teacherId?: string
  ) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
    });
    if (!student) throw new NotFoundException('Perfil no encontrado');

    const targetDate = new Date(dateString);
    let dayOfWeek = targetDate.getUTCDay();
    if (dayOfWeek === 0) dayOfWeek = 7;

    // 0. Validar que no tenga otra reserva activa
    const activeBooking = await this.prisma.booking.findFirst({
      where: {
        studentId: student.id,
        status: 'BOOKED'
      }
    });

    if (activeBooking) {
      throw new BadRequestException('Ya tienes una clase reservada. Debes asistir a esa clase o cancelarla antes de poder reservar una nueva.');
    }

    // 0. Validar Horizonte de Reserva (Máximo 2 días)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDateObj = new Date(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate());
    
    const diffTime = targetDateObj.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      throw new BadRequestException('No puedes reservar clases en el pasado.');
    }

    if (diffDays === 0) {
      // Validar hora si es hoy
      const [hours, minutes] = startTime.split(':').map(Number);
      const classTime = new Date();
      classTime.setHours(hours, minutes, 0, 0);
      if (classTime.getTime() <= now.getTime()) {
        throw new BadRequestException('La hora de la clase ya ha pasado. Por favor elige otro horario.');
      }
    }
    // Si es viernes (5) o sábado (6) y quiere reservar para lunes (1), la diferencia puede ser hasta 3 días.
    let maxDaysAllowed = 2;
    if ((now.getDay() === 5 || now.getDay() === 6) && targetDate.getUTCDay() === 1) {
      maxDaysAllowed = 3;
    }

    if (diffDays > maxDaysAllowed) {
      throw new BadRequestException(`Solo puedes reservar clases con un máximo de ${maxDaysAllowed} días de anticipación.`);
    }

    // 1. Validar Límite Diario (1 por día)
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const classesSameDay = await this.prisma.booking.count({
      where: {
        studentId: student.id,
        classSession: { date: { gte: startOfDay, lt: endOfDay } },
        status: { not: 'CANCELED' }
      }
    });
    if (classesSameDay > 0) throw new BadRequestException('Solo puedes reservar 1 clase por día');

    // 1.5 Validar Límite Semanal (6 por semana)
    const weekStartTotal = new Date(targetDate);
    weekStartTotal.setUTCDate(targetDate.getUTCDate() - (targetDate.getUTCDay() === 0 ? 6 : targetDate.getUTCDay() - 1));
    weekStartTotal.setUTCHours(0, 0, 0, 0);
    const weekEndTotal = new Date(weekStartTotal);
    weekEndTotal.setUTCDate(weekStartTotal.getUTCDate() + 7);

    const weeklyTotalBookings = await this.prisma.booking.count({
      where: {
        studentId: student.id,
        classSession: { date: { gte: weekStartTotal, lt: weekEndTotal } },
        status: { not: 'CANCELED' }
      }
    });
    if (weeklyTotalBookings >= 6) {
      throw new BadRequestException('Has alcanzado el límite máximo de 6 clases por semana.');
    }

    // ==========================================
    // INTENTO 1: Buscar clase existente (Match)
    // ==========================================
    const existingClasses = await this.prisma.classSession.findMany({
      where: {
        status: 'OPEN',
        date: targetDate,
        start_time: startTime,
        session_type: student.current_session_type,
        anchor_lesson: {
          gte: Math.max(1, student.current_lesson - 3),
          lte: Math.min(50, student.current_lesson + 3),
        }
      },
      include: { 
        _count: { 
          select: { 
            bookings: { where: { status: { not: 'CANCELED' } } } 
          } 
        } 
      }
    });

    const availableClass = existingClasses.find(c => c._count.bookings < 5);

    if (availableClass) {
      const booking = await this.prisma.booking.create({
        data: {
          studentId: student.id,
          classId: availableClass.id,
          token_used: 'JOIN', // Gasta token normal silenciosamente
        }
      });

      if (availableClass._count.bookings + 1 === 5) {
        await this.prisma.classSession.update({
          where: { id: availableClass.id },
          data: { status: 'CLOSED' }
        });
      }
      
      await this.audit.logAction(
        actorId, 
        actorRole, 
        'CLASS_BOOKED_JOIN', 
        'Booking', 
        booking.id, 
        `Se unió al alumno a clase existente id ${availableClass.id}`
      );
      
      return { message: 'Te has unido exitosamente a un grupo programado.', booking };
    }

    // ==========================================
    // INTENTO 2: Intentar crear Clase Ancla
    // ==========================================

    // Verificar límite semanal de Tokens Ancla (Max 3)
    const weekStart = new Date(targetDate);
    weekStart.setUTCDate(targetDate.getUTCDate() - (targetDate.getUTCDay() === 0 ? 6 : targetDate.getUTCDay() - 1));
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

    const anchorTokensUsed = await this.prisma.booking.count({
      where: {
        studentId: student.id,
        token_used: 'ANCHOR',
        classSession: { date: { gte: weekStart, lt: weekEnd } },
        status: { not: 'CANCELED' }
      }
    });

    if (anchorTokensUsed >= 3) {
      // El alumno ya agotó sus 3 comodines de abrir clase
      throw new BadRequestException('No hay grupos disponibles en este horario y ya has agotado tu límite semanal para solicitar apertura de nuevos horarios. Por favor, selecciona un horario donde ya exista una clase abierta.');
    }

    // Si tiene tokens ancla, necesitamos un profesor
    if (!teacherId) {
      throw new BadRequestException('Para abrir una nueva clase necesitas seleccionar un profesor de la lista de disponibles.');
    }

    // Verificar que el profesor elegido esté realmente disponible
    const schedule = await this.prisma.teacherAvailability.findFirst({
      where: { day_of_week: dayOfWeek, start_time: startTime, teacherId: teacherId },
      include: { teacher: true }
    });
    if (!schedule) throw new BadRequestException('El profesor seleccionado no trabaja en ese horario.');

    const isExamSession = student.current_session_type === 'EXAM_WRITTEN' || student.current_session_type === 'EXAM_ORAL';
    if (isExamSession && !schedule.teacher.can_conduct_exams) {
      throw new BadRequestException('El profesor seleccionado no está habilitado para tomar exámenes.');
    }

    const isBusy = await this.prisma.classSession.findFirst({
      where: {
        teacherId: teacherId,
        date: targetDate,
        start_time: startTime,
          status: { notIn: ['COMPLETED', 'CANCELED'] }
      }
    });
    if (isBusy) throw new BadRequestException('El profesor seleccionado ya fue ocupado por otro grupo. Por favor, selecciona otro.');

    // Crear la clase ancla con el profesor seleccionado
    const result = await this.prisma.$transaction(async (prisma) => {
      const newClass = await prisma.classSession.create({
        data: {
          teacherId: teacherId,
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
          token_used: 'ANCHOR', // Consume el comodín silenciosamente
        }
      });

      await prisma.auditLog.create({
        data: {
          actorId: actorId,
          actorRole: actorRole,
          action: 'CLASS_BOOKED_ANCHOR',
          entityType: 'Booking',
          entityId: newBooking.id,
          details: `Se creó clase ancla para alumno para fecha ${targetDate.toISOString()} a las ${startTime}`,
        }
      });

      return { message: 'Reserva confirmada exitosamente.', newClass, newBooking }; // Mensaje neutral
    });

    return result;
  }

  async forceBookClass(studentUserId: string, classId: string, actorRole: string) {
    if (actorRole !== 'SECRETARY' && actorRole !== 'ADMIN') {
      throw new BadRequestException('Solo el personal autorizado puede forzar cupos.');
    }

    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
    });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    const classSession = await this.prisma.classSession.findUnique({
      where: { id: classId },
      include: {
        _count: {
          select: { bookings: { where: { status: { not: 'CANCELED' } } } }
        }
      }
    });

    if (!classSession) throw new NotFoundException('Clase no encontrada');

    // Aquí no verificamos límite de 5, justamente es para forzar
    if (classSession.status !== 'OPEN' && classSession.status !== 'CLOSED') {
      throw new BadRequestException('La clase ya no está disponible para inscripción.');
    }

    // 0. Validar que no tenga otra reserva activa
    const activeBooking = await this.prisma.booking.findFirst({
      where: {
        studentId: student.id,
        status: 'BOOKED'
      }
    });

    if (activeBooking) {
      throw new BadRequestException('El estudiante ya tiene una clase reservada y activa. Debe asistir a esa clase o cancelarla antes de poder reservarle una nueva.');
    }

    // Validar que la clase no haya empezado
    const [year, month, day] = classSession.date.toISOString().split('T')[0].split('-').map(Number);
    const [hours, minutes] = classSession.start_time.split(':').map(Number);
    const classDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

    if (new Date().getTime() >= classDateTime.getTime()) {
      throw new BadRequestException('No puedes inscribir a un alumno en una clase que ya ha comenzado.');
    }

    // Verificar límite diario (1 por día) incluso para la secretaria
    const startOfDay = new Date(classSession.date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const classesSameDay = await this.prisma.booking.count({
      where: {
        studentId: student.id,
        classSession: { date: { gte: startOfDay, lt: endOfDay } },
        status: { not: 'CANCELED' }
      }
    });
    if (classesSameDay > 0) {
      throw new BadRequestException('El estudiante ya tiene una clase programada o completada para este mismo día.');
    }

    // Verificar si ya está reservado en esta misma clase
    const existingBooking = await this.prisma.booking.findFirst({
      where: {
        studentId: student.id,
        classId: classSession.id,
        status: { not: 'CANCELED' }
      }
    });

    if (existingBooking) {
      throw new BadRequestException('El alumno ya está en este grupo.');
    }

    // Identificar el token a usar
    let tokenType: 'ANCHOR' | 'JOIN' = 'JOIN';
    if (classSession._count.bookings === 0) {
      tokenType = 'ANCHOR';
    }

    // Omitimos validaciones de tokens (es un override de la secretaria)
    const booking = await this.prisma.booking.create({
      data: {
        classId: classSession.id,
        studentId: student.id,
        token_used: tokenType,
        status: 'BOOKED'
      }
    });

    return booking;
  }

  async forceCreateAnchorClass(studentUserId: string, teacherId: string, dateString: string, startTime: string, actorRole: string) {
    if (actorRole !== 'SECRETARY' && actorRole !== 'ADMIN') {
      throw new BadRequestException('Solo personal autorizado puede forzar la apertura de clases.');
    }

    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
    });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    const targetDate = new Date(dateString);
    let dayOfWeek = targetDate.getUTCDay();
    if (dayOfWeek === 0) dayOfWeek = 7;

    // 0. Validar que no tenga otra reserva activa
    const activeBooking = await this.prisma.booking.findFirst({
      where: {
        studentId: student.id,
        status: 'BOOKED'
      }
    });

    if (activeBooking) {
      throw new BadRequestException('El estudiante ya tiene una clase reservada y activa. Debe asistir a esa clase o cancelarla antes de poder reservarle una nueva.');
    }

    // Verificar límite diario (1 por día) incluso para la secretaria
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const classesSameDay = await this.prisma.booking.count({
      where: {
        studentId: student.id,
        classSession: { date: { gte: startOfDay, lt: endOfDay } },
        status: { not: 'CANCELED' }
      }
    });
    if (classesSameDay > 0) {
      throw new BadRequestException('Atención: El estudiante ya tiene una clase programada (o una falta injustificada) registrada para este mismo día. El límite es de 1 clase diaria.');
    }

    // Verificar que el profesor realmente trabaje en ese horario
    const schedule = await this.prisma.teacherAvailability.findFirst({
      where: { day_of_week: dayOfWeek, start_time: startTime, teacherId: teacherId },
      include: { teacher: true }
    });
    if (!schedule) {
      throw new BadRequestException('El profesor seleccionado no trabaja en ese horario. Por favor, selecciona un profesor disponible.');
    }

    const isExamSession = student.current_session_type === 'EXAM_WRITTEN' || student.current_session_type === 'EXAM_ORAL';
    if (isExamSession && !schedule.teacher.can_conduct_exams) {
      throw new BadRequestException('El profesor seleccionado no está habilitado para tomar exámenes.');
    }

    const isBusy = await this.prisma.classSession.findFirst({
      where: {
        teacherId: teacherId,
        date: targetDate,
        start_time: startTime,
          status: { notIn: ['COMPLETED', 'CANCELED'] }
      }
    });
    if (isBusy) throw new BadRequestException('El profesor ya está ocupado en ese horario.');

    return this.prisma.$transaction(async (prisma) => {
      const newClass = await prisma.classSession.create({
        data: {
          teacherId: teacherId,
          date: targetDate,
          start_time: startTime,
          session_type: student.current_session_type,
          anchor_lesson: student.current_lesson,
          status: 'OPEN',
        }
      });

      const newBooking = await prisma.booking.create({
        data: {
          classId: newClass.id,
          studentId: student.id,
          token_used: 'ANCHOR',
          status: 'BOOKED'
        }
      });

      return { message: 'Clase ancla creada e inscrita forzosamente.', newClass, newBooking };
    });
  }

  async getAvailableTeachers(dateString: string, startTime: string, studentUserId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId }
    });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    const isExamSession = student.current_session_type === 'EXAM_WRITTEN' || student.current_session_type === 'EXAM_ORAL';

    const targetDate = new Date(dateString);
    let dayOfWeek = targetDate.getUTCDay();
    if (dayOfWeek === 0) dayOfWeek = 7;

    const [year, month, day] = dateString.split('-').map(Number);
    const [hours, minutes] = startTime.split(':').map(Number);
    const classTime = new Date(year, month - 1, day, hours, minutes, 0);
    const now = new Date();

    if (classTime.getTime() <= now.getTime()) {
      return []; // No hay profesores disponibles porque la hora ya pasó
    }

    const availableSchedules = await this.prisma.teacherAvailability.findMany({
      where: { day_of_week: dayOfWeek, start_time: startTime },
      include: { teacher: { include: { user: true } } }
    });

    const freeTeachers = [];
    for (const schedule of availableSchedules) {
      if (isExamSession && !schedule.teacher.can_conduct_exams) {
        continue;
      }

      const isBusy = await this.prisma.classSession.findFirst({
        where: {
          teacherId: schedule.teacherId,
          date: targetDate,
          start_time: startTime,
            status: { notIn: ['COMPLETED', 'CANCELED'] }
        }
      });
      if (!isBusy) {
        freeTeachers.push({
          id: schedule.teacherId,
          name: schedule.teacher.user.name
        });
      }
    }
    return freeTeachers;
  }

  async cancelBooking(studentUserId: string, actorId: string, actorRole: Role, bookingId: string) {
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
    const [year, month, day] = date.toISOString().split('T')[0].split('-').map(Number);
    const [hours, minutes] = start_time.split(':').map(Number);
    const classDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

    const now = new Date();
    const diffMs = classDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    let returnMessage = '';

    if (diffHours >= 5) {
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELED', observations: 'Cancelado por el alumno (A tiempo)' }
      });

      if (booking.classSession.status === 'CLOSED') {
        await this.prisma.classSession.update({
          where: { id: booking.classSession.id },
          data: { status: 'OPEN' }
        });
      }
      
      await this.audit.logAction(actorId, actorRole, 'CLASS_CANCELED_ON_TIME', 'Booking', bookingId, `Cancelación a tiempo (>= 5hrs) del alumno ${studentUserId}.`);
      returnMessage = 'Clase cancelada exitosamente a tiempo. Conservas tu cupo.';
    } else {
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'ABSENT_NO_SHOW', grade: 0, observations: 'Cancelación tardía por el alumno' }
      });
      
      await this.audit.logAction(actorId, actorRole, 'CLASS_CANCELED_LATE', 'Booking', bookingId, `Cancelación tardía (< 5hrs) del alumno ${studentUserId}. Falta y nota 0.`);
      returnMessage = 'Cancelación tardía (menos de 5 horas). Se ha marcado como Falta Injustificada con nota 0.';
    }

    // Comprobar si la clase se quedó vacía
    const remainingActiveBookings = await this.prisma.booking.count({
      where: {
        classId: booking.classSession.id,
        status: {
          in: ['BOOKED', 'ATTENDED']
        }
      }
    });

    if (remainingActiveBookings === 0) {
      // Cancelar la clase para que el profesor quede libre
      await this.prisma.classSession.update({
        where: { id: booking.classSession.id },
        data: { status: 'CANCELED' }
      });
      returnMessage += ' Y dado que eras el único alumno, la clase ha sido cancelada para liberar al profesor.';
    }

    return { message: returnMessage };
  }

  async gradeBooking(actorId: string, actorRole: Role, bookingId: string, grade: number, observations?: string) {
    if (grade < 0 || grade > 100) throw new BadRequestException('La nota debe estar entre 0 y 100');
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { classSession: { include: { teacher: true } }, student: true }
    });

    if (!booking) throw new NotFoundException('Reserva no encontrada');
    
    // Si es profesor, verificar que sea el profesor de esa clase
    if (actorRole === Role.TEACHER && booking.classSession.teacher.userId !== actorId) {
      throw new BadRequestException('No tienes permisos.');
    }
    
    if (booking.status === 'CANCELED' || booking.status === 'ABSENT_NO_SHOW') throw new BadRequestException('Alumno con falta.');

    // Validar que la clase ya haya empezado
    const [year, month, day] = booking.classSession.date.toISOString().split('T')[0].split('-').map(Number);
    const [hours, minutes] = booking.classSession.start_time.split(':').map(Number);
    
    // Asumimos que la hora '17:00' se refiere a la hora local del instituto/servidor
    const classDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

    if (new Date().getTime() < classDateTime.getTime()) {
      throw new BadRequestException('No puedes calificar una clase antes de su horario de inicio.');
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { grade, status: 'ATTENDED', observations }
    });

    if (grade >= 81) {
      const student = booking.student;
      let nextSessionType = student.current_session_type;
      let nextLesson = student.current_lesson;

      if (student.current_session_type === 'ESSENTIAL') {
        nextSessionType = 'WORKING_CLASS';
      } else if (student.current_session_type === 'WORKING_CLASS') {
        nextSessionType = 'SPEAK_OUT';
      } else if (student.current_session_type === 'SPEAK_OUT') {
        const EXAM_MILESTONES = [5, 10, 15, 20, 25, 30, 40, 50];
        if (EXAM_MILESTONES.includes(nextLesson)) {
          nextSessionType = 'EXAM_WRITTEN' as any;
        } else {
          nextSessionType = 'ESSENTIAL';
          nextLesson += 1;
        }
      } else if (student.current_session_type === 'EXAM_WRITTEN') {
        nextSessionType = 'EXAM_ORAL' as any;
      } else if (student.current_session_type === 'EXAM_ORAL') {
        if (nextLesson < 50) {
          nextSessionType = 'ESSENTIAL';
          nextLesson += 1;
        } else {
          // Si es la lección 50 EXAM_ORAL, no avanzamos más allá de 50.
          nextLesson = 50;
          nextSessionType = 'EXAM_ORAL' as any;
        }
      }

      await this.prisma.studentProfile.update({
        where: { id: student.id },
        data: { current_session_type: nextSessionType, current_lesson: nextLesson }
      });
      
      await this.audit.logAction(actorId, actorRole, 'GRADE_ASSIGNED', 'Booking', bookingId, `Asignó nota ${grade} (Aprobado). Estudiante avanzó a ${nextSessionType} lección ${nextLesson}.`);
      return { message: 'Calificación guardada. Alumno aprobado.' };
    } else {
      await this.audit.logAction(actorId, actorRole, 'GRADE_ASSIGNED', 'Booking', bookingId, `Asignó nota ${grade} (Reprobado). Estudiante se mantiene en la misma sesión.`);
      return { message: 'Calificación guardada. Alumno reprobado.' };
    }
  }

  async markAbsent(actorId: string, actorRole: Role, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { classSession: { include: { teacher: true } }, student: true }
    });

    if (!booking) throw new NotFoundException('Reserva no encontrada');
    
    if (actorRole === Role.TEACHER && booking.classSession.teacher.userId !== actorId) {
      throw new BadRequestException('No tienes permisos.');
    }
    
    if (booking.status === 'CANCELED' || booking.status === 'ABSENT_NO_SHOW') {
      throw new BadRequestException('El alumno ya tiene marcada la falta o cancelación.');
    }

    // Validar que la clase ya haya empezado
    const [year, month, day] = booking.classSession.date.toISOString().split('T')[0].split('-').map(Number);
    const [hours, minutes] = booking.classSession.start_time.split(':').map(Number);
    
    const classDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

    if (new Date().getTime() < classDateTime.getTime()) {
      throw new BadRequestException('No puedes marcar falta antes del horario de inicio de la clase.');
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { grade: 0, status: 'ABSENT_NO_SHOW' }
    });

    await this.audit.logAction(actorId, actorRole, 'STUDENT_ABSENT', 'Booking', bookingId, 'El profesor marcó falta injustificada (nota 0).');
    return { message: 'Se ha registrado la inasistencia.' };
  }
}
