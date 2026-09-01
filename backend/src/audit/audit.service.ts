import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async logAction(
    actorId: string,
    actorRole: Role,
    action: string,
    entityType: string,
    entityId: string,
    details: string
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorRole,
        action,
        entityType,
        entityId,
        details,
      },
    });
  }
}
