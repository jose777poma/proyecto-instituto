import { Module } from '@nestjs/common';
import { ClassesService } from './classes.service.js';
import { ClassesController } from './classes.controller.js';

@Module({
  providers: [ClassesService],
  controllers: [ClassesController]
})
export class ClassesModule {}
