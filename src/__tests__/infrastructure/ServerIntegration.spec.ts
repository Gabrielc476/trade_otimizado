import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../infrastructure/server/app.module';
import { INestApplication } from '@nestjs/common';

// Mock the pg module to prevent database connection failures in the test sandbox
const mockClient = {
  query: jest.fn(() => Promise.resolve({ rows: [] })),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn(() => Promise.resolve(mockClient)),
  query: jest.fn(() => Promise.resolve({ rows: [] })),
  end: jest.fn(() => Promise.resolve()),
};

jest.mock('pg', () => {
  return {
    Pool: jest.fn(() => mockPool),
  };
});

describe('ServerIntegration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Bootstrap the real NestJS server on a test port
    app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(3002);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should successfully compile and bootstrap the NestJS application', () => {
    expect(app).toBeDefined();
  });
});
