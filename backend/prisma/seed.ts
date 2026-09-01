import { PrismaClient, Role, SessionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Wiping database...');
  // Delete in correct order to avoid foreign key constraints
  await prisma.auditLog.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.classSession.deleteMany();
  await prisma.teacherAvailability.deleteMany();
  await prisma.teacherProfile.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash('admin', 10);
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  console.log('Creating Admin...');
  await prisma.user.create({
    data: {
      email: 'admin@ok.com',
      password_hash: password,
      name: 'Admin',
      role: Role.ADMIN
    }
  });

  console.log('Creating Secretary...');
  await prisma.user.create({
    data: {
      email: 'secretaria@ok.com',
      password_hash: password,
      name: 'Secretaria',
      role: Role.SECRETARY
    }
  });

  console.log('Creating 5 Teachers...');
  for (let i = 1; i <= 5; i++) {
    await prisma.user.create({
      data: {
        email: `teacher${i}@ok.com`,
        password_hash: password,
        name: `Teacher ${i}`,
        role: Role.TEACHER,
        teacherProfile: {
          create: {
            can_conduct_exams: i <= 2 // Teachers 1 and 2 can conduct exams
          }
        }
      }
    });
  }

  console.log('Creating 20 Students...');
  
  // Mix of levels and session types to allow for broad testing
  const studentConfigurations: { lesson: number, type: SessionType }[] = [
    { lesson: 1, type: 'ESSENTIAL' },
    { lesson: 1, type: 'WORKING_CLASS' },
    { lesson: 2, type: 'SPEAK_OUT' },
    { lesson: 4, type: 'SPEAK_OUT' }, // About to reach milestone 5
    { lesson: 5, type: 'EXAM_WRITTEN' }, // Milestone 5 Written
    { lesson: 5, type: 'EXAM_ORAL' }, // Milestone 5 Oral
    { lesson: 6, type: 'ESSENTIAL' }, // Passed Milestone 5
    { lesson: 9, type: 'SPEAK_OUT' },
    { lesson: 10, type: 'EXAM_WRITTEN' },
    { lesson: 14, type: 'SPEAK_OUT' }, // About to finish basic level
    { lesson: 15, type: 'EXAM_ORAL' }, // End of basic level Oral
    { lesson: 16, type: 'ESSENTIAL' }, // Intermediate Level Start
    { lesson: 19, type: 'SPEAK_OUT' },
    { lesson: 20, type: 'EXAM_WRITTEN' },
    { lesson: 25, type: 'EXAM_ORAL' },
    { lesson: 29, type: 'SPEAK_OUT' },
    { lesson: 30, type: 'EXAM_ORAL' }, // End of intermediate Level
    { lesson: 31, type: 'ESSENTIAL' }, // Advanced Level Start
    { lesson: 39, type: 'SPEAK_OUT' }, // About to reach milestone 40
    { lesson: 50, type: 'EXAM_ORAL' }, // End of everything
  ];

  for (let i = 1; i <= 20; i++) {
    const config = studentConfigurations[i - 1];
    await prisma.user.create({
      data: {
        email: `est${i}@ok.com`,
        password_hash: password,
        name: `Est ${i} (L${config.lesson} ${config.type.replace('_', ' ')})`,
        role: Role.STUDENT,
        studentProfile: {
          create: {
            current_lesson: config.lesson,
            current_session_type: config.type,
            access_expires_at: nextMonth
          }
        }
      }
    });
  }

  console.log('Seed exitoso. Todos los usuarios creados correctamente con contraseña "admin"');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
