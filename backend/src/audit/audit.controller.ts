import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Roles(Role.ADMIN)
  async getAuditLogs(@Query('limit') limit = 50) {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: Number(limit)
    });
    
    // Obtener nombres de actores
    const actorIds = [...new Set(logs.map(l => l.actorId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true, email: true }
    });
    
    const userMap = users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<string, any>);
    
    return logs.map(log => ({
      ...log,
      actorName: userMap[log.actorId]?.name || 'Usuario Eliminado',
      actorEmail: userMap[log.actorId]?.email || ''
    }));
  }
}
