// o filtro global constrói o corpo de erro a partir desta classe pra documentação no
// swagger não poder divergir do que a api devolve de verdade
export class ApiErrorDto {
  status_code: number;
  error: string;
  message: string | string[];
  path: string;
  correlation_id: string | null;
  timestamp: string;

  constructor(dados: Omit<ApiErrorDto, 'timestamp'>) {
    this.status_code = dados.status_code;
    this.error = dados.error;
    this.message = dados.message;
    this.path = dados.path;
    this.correlation_id = dados.correlation_id;
    this.timestamp = new Date().toISOString();
  }
}
