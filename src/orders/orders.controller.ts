import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorDto } from '../common/filters/api-error.dto';
import { ListOrdersQuery } from './dto/list-orders.dto';
import { OrderDetailDto, OrderListDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @ApiResponse({
    status: 200,
    description: 'pedidos do mais recente pro mais antigo',
    type: OrderListDto,
  })
  async list(@Query() query: ListOrdersQuery): Promise<OrderListDto> {
    const { rows, total } = await this.orders.list(query);

    return new OrderListDto(rows, { page: query.page, limit: query.limit, total });
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'pedido com os itens', type: OrderDetailDto })
  @ApiResponse({ status: 404, description: 'pedido nao existe', type: ApiErrorDto })
  async byId(@Param('id', ParseUUIDPipe) id: string): Promise<OrderDetailDto> {
    const order = await this.orders.findById(id);

    if (!order) throw new NotFoundException(`pedido ${id} nao encontrado`);

    return new OrderDetailDto(order);
  }
}
