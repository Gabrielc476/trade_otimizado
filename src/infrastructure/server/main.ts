import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  console.log('Bootstrapping ApexTrade NestJS Server...');
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend requests
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Enable global validation pipes for DTOs/requests
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  const port = 3001;
  await app.listen(port);
  console.log(`ApexTrade NestJS Server is running on: http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during NestJS server bootstrap:', err);
  process.exit(1);
});
