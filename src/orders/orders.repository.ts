import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderStatus } from './order-status.enum';

const UNIQUE_VIOLATION = '23505';

export type ListFilter = { status?: OrderStatus; page: number; limit: number };

// classe concreta, sem interface: o ponto de substituição real desse sistema é o
// provedor de enriquecimento, não o banco. abstrair o postgres aqui seria cerimônia
@Injectable()
export class OrdersRepository {
  constructor(
    @InjectRepository(Order)
    private readonly repo: Repository<Order>,
  ) {}

  async create(order: Order): Promise<{ order: Order; duplicated: boolean }> {
    try {
      return { order: await this.repo.save(order), duplicated: false };
    } catch (err) {
      if (!isDuplicate(err)) throw err;

      // nada de SELECT antes do INSERT: duas requisições simultâneas passariam as duas
      // pela verificação. deixa o banco falhar no unique e devolve o pedido que já existe
      const existing = await this.repo.findOneOrFail({
        where: { idempotencyKey: order.idempotencyKey },
        relations: { items: true },
      });

      return { order: existing, duplicated: true };
    }
  }

  async findById(id: string): Promise<Order | null> {
    return this.repo.findOne({ where: { id }, relations: { items: true } });
  }

  async save(order: Order): Promise<Order> {
    return this.repo.save(order);
  }

  // sem relations aqui de propósito: carregar os itens na listagem viraria join com
  // distinct e o planner larga o idx_orders_status. item é assunto do GET /orders/:id
  // offset da conta no volume desse teste. em tabela grande offset alto fica caro e a
  // saída seria keyset (where created_at < cursor), mas isso muda o contrato da api
  async list(filter: ListFilter): Promise<{ rows: Order[]; total: number }> {
    const [rows, total] = await this.repo.findAndCount({
      where: filter.status ? { status: filter.status } : {},
      order: { createdAt: 'DESC' },
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
    });

    return { rows, total };
  }
}

function isDuplicate(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err.driverError as { code?: string })?.code === UNIQUE_VIOLATION
  );
}
