import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { ApiErrorDto } from './api-error.dto';

// getStatus() devolve number puro, então comparar direto com o enum faz o ts reclamar de
// enum sem tipo compartilhado. o const tipado resolve sem perder o nome da constante
const SERVER_ERROR: number = HttpStatus.INTERNAL_SERVER_ERROR;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly pino: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<{ id?: string; url: string }>();
    const res = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= SERVER_ERROR) {
      this.pino.error(
        { context: AllExceptionsFilter.name, err: exception, path: req.url },
        'erro nao tratado',
      );
    }

    res.status(status).json(
      new ApiErrorDto({
        status_code: status,
        ...corpo(exception, status),
        path: req.url,
        correlation_id: req.id ?? null,
      }),
    );
  }
}

// 500 sai sem detalhe de propósito: mensagem de erro interno é mapa pra quem está sondando
// a aplicação. o stack vai pro log com o correlation id, que é onde ele serve pra algo
function corpo(exception: unknown, status: number): { error: string; message: string | string[] } {
  if (status >= SERVER_ERROR) {
    return { error: 'Internal Server Error', message: 'erro interno' };
  }

  const resposta = (exception as HttpException).getResponse();

  if (typeof resposta === 'string') {
    return { error: (exception as HttpException).name, message: resposta };
  }

  const { error, message } = resposta as { error?: string; message?: string | string[] };

  return {
    error: error ?? (exception as HttpException).name,
    message: message ?? (exception as HttpException).message,
  };
}
