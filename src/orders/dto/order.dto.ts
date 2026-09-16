import { OrderItem } from '../entities/order-item.entity';
import { OrderStatus } from '../order-status.enum';
import { Order } from '../entities/order.entity';

export class OrderItemDto {
  sku: string;
  qty: number;
  unit_price: number;
  product_name: string | null;
  discount_percentage: number | null;
  final_unit_price: number | null;

  constructor(item: OrderItem) {
    this.sku = item.sku;
    this.qty = item.qty;
    this.unit_price = item.unitPrice;
    this.product_name = item.productName;
    this.discount_percentage = item.discountPercentage;
    this.final_unit_price = item.finalUnitPrice;
  }
}

// o de/para vive aqui pra entidade não vazar pro json: idempotency_key e updated_at são
// mecânica interna nossa, e id de item não serve pra nada de fora
export class OrderDto {
  id: string;
  order_id: string;
  source: string;
  status: OrderStatus;
  currency: string;
  customer: { name: string; email: string };
  subtotal: number;
  discount_total: number;
  total: number;
  created_at: Date;
  enriched_at: Date | null;
  failure_reason: string | null;
  converted_total: number | null;
  exchange_rate: number | null;
  rate_date: string | null;

  constructor(order: Order) {
    this.id = order.id;
    this.order_id = order.externalOrderId;
    this.source = order.source;
    this.status = order.status;
    this.currency = order.currency;
    this.customer = { name: order.customerName, email: order.customerEmail };
    this.subtotal = order.subtotal;
    this.discount_total = order.discountTotal;
    this.total = order.total;
    this.created_at = order.createdAt;
    this.enriched_at = order.enrichedAt;
    this.failure_reason = order.failureReason;
    this.converted_total = order.convertedTotal;
    this.exchange_rate = order.exchangeRate;
    this.rate_date = order.rateDate;
  }
}

export class OrderListDto {
  data: OrderDto[];
  meta: { page: number; limit: number; total: number };

  constructor(orders: Order[], meta: { page: number; limit: number; total: number }) {
    this.data = orders.map((order) => new OrderDto(order));
    this.meta = meta;
  }
}

export class OrderDetailDto extends OrderDto {
  items: OrderItemDto[];

  constructor(order: Order) {
    super(order);

    this.items = order.items.map((item) => new OrderItemDto(item));
  }
}
