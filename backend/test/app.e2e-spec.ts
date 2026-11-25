import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { setupApp } from './../src/common/config/app-setup';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Giống main.ts: prefix /api, helmet, CORS, ValidationPipe
    setupApp(app);
    await app.init();
  });

  it('GET /api — được ResponseTransformInterceptor bọc thành { success: true, data, ... }', async () => {
    const res = await request(app.getHttpServer()).get('/api').expect(200);

    expect(res.body).toEqual({
      success: true,
      statusCode: 200,
      message: 'Thành công',
      data: 'Hello World!',
      timestamp: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });

  it('route không tồn tại — được HttpExceptionFilter bọc thành { success: false, ... }', async () => {
    const res = await request(app.getHttpServer()).get('/api/khong-ton-tai').expect(404);

    expect(res.body).toEqual({
      success: false,
      statusCode: 404,
      message: expect.any(String),
      path: expect.stringContaining('/khong-ton-tai'),
      timestamp: expect.any(String),
    });
  });

  afterAll(async () => {
    await app?.close();
  });
});
