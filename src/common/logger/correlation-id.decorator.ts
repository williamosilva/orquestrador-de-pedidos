import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export const CorrelationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    return ctx.switchToHttp().getRequest<{ id: string }>().id;
  },
);
