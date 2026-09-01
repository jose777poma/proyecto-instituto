import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('admin', 10);

// ... (reemplazando todas las ocurrencias de password por password_hash en create)
  // 1. Estudiante
  const student = await prisma.user.upsert({
    where: { email: 'juan.perez@ok.com' },
    update: {},
    create: {
      email: 'juan.perez@ok.com',
      password_hash: password,
      name: 'Juan Pérez',
      role: Role.STUDENT,
      studentProfile: {
        create: {
          current_lesson: 5,
          current_session_type: 'WORKING_CLASS',
          access_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      }
    }
  });

  const student2 = await prisma.user.upsert({
    where: { email: 'maria.gomez@ok.com' },
    update: {},
    create: {
      email: 'maria.gomez@ok.com',
      password_hash: password,
      name: 'María Gómez',
      role: Role.STUDENT,
      studentProfile: {
        create: {
          current_lesson: 5,
          current_session_type: 'WORKING_CLASS',
          access_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      }
    }
  });

  const student3 = await prisma.user.upsert({
    where: { email: 'carlos.lopez@ok.com' },
    update: {},
    create: {
      email: 'carlos.lopez@ok.com',
      password_hash: password,
      name: 'Carlos López',
      role: Role.STUDENT,
      studentProfile: {
        create: {
          current_lesson: 5,
          current_session_type: 'WORKING_CLASS',
          access_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      }
    }
  });

  // 2. Profesor
  const teacher = await prisma.user.upsert({
    where: { email: 'profesor@ok.com' },
    update: {},
    create: {
      email: 'profesor@ok.com',
      password_hash: password,
      name: 'Prof. Sarah M.',
      role: Role.TEACHER,
      teacherProfile: {
        create: {}
      }
    }
  });

  // 3. Secretaria
  const secretary = await prisma.user.upsert({
    where: { email: 'secretaria@ok.com' },
    update: {},
    create: {
      email: 'secretaria@ok.com',
      password_hash: password,
      name: 'Secretaria Ana',
      role: Role.SECRETARY
    }
  });

  // 4. Administrador
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ok.com' },
    update: {},
    create: {
      email: 'admin@ok.com',
      password_hash: password,
      name: 'Administrador General',
      role: Role.ADMIN
    }
  });

  console.log('Seed exitoso:');
  console.log('Estudiante:', student.email);
  console.log('Profesor:', teacher.email);
  console.log('Secretaria:', secretary.email);
  console.log('Admin:', admin.email);
  console.log('Contraseña para todos: admin');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
