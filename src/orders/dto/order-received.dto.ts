import { OrderStatus } from '../order-status.enum';
import { Order } from '../entities/order.entity';

export class OrderReceivedDto {
  id: string;
  status: OrderStatus;

  constructor(order: Order) {
    this.id = order.id;
    this.status = order.status;
  }
}
