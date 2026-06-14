import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.enableCors({ origin: true, credentials: true });

  const port = Number(process.env.API_PORT) || 3333;
  await app.listen(port);
  new Logger('Bootstrap').log(`Atende MEI API rodando em http://localhost:${port}/api`);
}

bootstrap();
