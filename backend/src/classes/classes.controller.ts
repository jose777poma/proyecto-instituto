import { Controller, Get, UseGuards, Request } from '@nestjs/common';
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
  @Roles(Role.STUDENT) // Solo los estudiantes pueden buscar clases
  getAvailableClasses(@Request() req: any) {
    // req.user contiene el payload del token JWT, incluyendo su userId
    return this.classesService.getAvailableClassesForStudent(req.user.userId);
  }
}
