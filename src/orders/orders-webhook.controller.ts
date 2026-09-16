import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ApiErrorDto } from '../common/filters/api-error.dto';
import { CorrelationId } from '../common/logger/correlation-id.decorator';
import { OrderReceivedDto } from './dto/order-received.dto';
import { ReceiveOrderDto } from './dto/receive-order.dto';
import { OrdersService } from './orders.service';

// exemplos ficam fora do decorator pra não empurrar o handler pra segunda tela. são os
// dois caminhos do enriquecimento: provedor HTTP e catálogo local
const EXEMPLOS = {
  dummyjson: {
    summary: 'SKU do DummyJSON (HTTP real)',
    value: {
      order_id: 'PED-8842',
      idempotency_key: 'loja-da-ana-8842',
      source: 'dummyjson',
      currency: 'BRL',
      customer: { name: 'Ana Silva', email: 'ana.silva@email.com' },
      items: [{ sku: 'DJ-15', qty: 2, unit_price: 89.9 }],
    },
  },
  catalogoInterno: {
    summary: 'SKU do catalogo interno (sem HTTP)',
    value: {
      order_id: 'PED-9001',
      idempotency_key: 'atelie-mara-9001',
      source: 'internal-catalog',
      currency: 'BRL',
      customer: { name: 'Rafael Moreira', email: 'rafael.moreira@email.com' },
      items: [{ sku: 'IC-1', qty: 1, unit_price: 129.9 }],
    },
  },
};

@ApiTags('webhooks')
@ApiHeader({
  name: 'x-correlation-id',
  required: false,
  description: 'reaproveitado nos logs e no job; se nao vier, a api gera um e devolve no header',
})
@Controller('webhooks/orders')
export class OrdersWebhookController {
  constructor(private readonly orders: OrdersService) {}

  // TODO: rate limit aqui qnd o volume de webhook subir. hoje a unica barreira contra
  // enxurrada de retry do emissor é a idempotencia
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBody({ type: ReceiveOrderDto, examples: EXEMPLOS })
  @ApiResponse({ status: 202, description: 'pedido novo', type: OrderReceivedDto })
  @ApiResponse({ status: 200, description: 'replay da mesma chave', type: OrderReceivedDto })
  @ApiResponse({ status: 422, description: 'payload invalido', type: ApiErrorDto })
  async receive(
    @Body() dto: ReceiveOrderDto,
    @CorrelationId() correlationId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderReceivedDto> {
    const { order, duplicated } = await this.orders.receive({
      externalOrderId: dto.order_id,
      idempotencyKey: dto.idempotency_key,
      correlationId,
      source: dto.source,
      currency: dto.currency,
      customer: dto.customer,
      items: dto.items.map((item) => ({
        sku: item.sku,
        qty: item.qty,
        unitPrice: item.unit_price,
      })),
    });

    // replay devolve 200 é nao 409 porque emissor de webhook trata 4xx como falha dele e
    // retenta mais rapido ainda. 200 comunica "ja recebi isso, pode parar de mandar"
    if (duplicated) res.status(HttpStatus.OK);

    return new OrderReceivedDto(order);
  }
}
