import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { PinoLogger } from 'nestjs-pino';
import { currentCorrelationId } from '../logger/correlation.store';

type Cronometrado = InternalAxiosRequestConfig & { start?: number };

@Injectable()
export class HttpLatencyInterceptor implements OnModuleInit {
  constructor(
    private readonly http: HttpService,
    private readonly pino: PinoLogger,
  ) {}

  onModuleInit(): void {
    const axios = this.http.axiosRef;

    axios.interceptors.request.use((cfg: Cronometrado) => {
      cfg.start = Date.now();

      return cfg;
    });

    axios.interceptors.response.use(
      (res: AxiosResponse) => {
        this.logar(res.config as Cronometrado, res.status);

        return res;
      },
      (err: AxiosError) => {
        this.logar(err.config as Cronometrado, err.response?.status);

        return Promise.reject(err);
      },
    );
  }

  private logar(cfg: Cronometrado | undefined, httpStatus?: number): void {
    this.pino.info(
      {
        context: 'ExternalCall',
        correlationId: currentCorrelationId() ?? null,
        method: cfg?.method?.toUpperCase() ?? null,
        url: cfg?.url ?? null,
        httpStatus: httpStatus ?? null,
        latencyMs: cfg?.start ? Date.now() - cfg.start : null,
      },
      'chamada externa concluida',
    );
  }
}
