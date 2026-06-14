import { Module } from '@nestjs/common';
import { PlanosController } from './planos.controller';

@Module({
  controllers: [PlanosController],
})
export class PlanosModule {}
