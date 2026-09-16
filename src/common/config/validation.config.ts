import { ValidationPipe } from '@nestjs/common';

// fabrica em vez de configurar direto no main porque o app de teste e2e precisa do mesmo
// pipe. duas configuracoes iguais em lugares diferentes viram duas diferentes em uma semana
export function validationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    // 422 é nao 400 porque emissor de webhook costuma tratar 400 como erro dele e
    // retentar em loop
    errorHttpStatusCode: 422,
  });
}
