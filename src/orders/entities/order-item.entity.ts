import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { numericTransformer } from './numeric.transformer';
import { finalUnitPrice } from '../order-totals';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column()
  sku: string;

  @Column('int')
  qty: number;

  @Column('numeric', {
    name: 'unit_price',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  unitPrice: number;

  @Column({ name: 'product_name', type: 'varchar', nullable: true })
  productName: string | null;

  @Column('numeric', {
    name: 'discount_percentage',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  discountPercentage: number | null;

  @Column('numeric', {
    name: 'final_unit_price',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  finalUnitPrice: number | null;

  applyEnrichment(productName: string, discountPercentage: number): void {
    this.productName = productName;
    this.discountPercentage = discountPercentage;
    this.finalUnitPrice = finalUnitPrice(this.unitPrice, discountPercentage);
  }
}
