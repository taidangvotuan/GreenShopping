import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorResponse } from '../interfaces/api-response.interface';

/**
 * Chuẩn hóa mọi lỗi thành { success: false, statusCode, message, errors?, path, timestamp }.
 * Lỗi không lường trước → 500 với thông điệp chung (không lộ stack/SQL ra client).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau';
    let errors: string[] | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const raw = (body as { message?: string | string[] }).message;
        if (Array.isArray(raw)) {
          message = 'Dữ liệu không hợp lệ';
          errors = raw;
        } else if (raw) {
          message = raw;
        }
      }
    } else if (isPrismaUniqueViolation(exception)) {
      statusCode = HttpStatus.CONFLICT;
      message = 'Dữ liệu đã tồn tại';
    } else {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const payload: ApiErrorResponse = {
      success: false,
      statusCode,
      message,
      ...(errors ? { errors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(statusCode).json(payload);
  }
}

function isPrismaUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002';
}
