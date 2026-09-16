import type { OrderItem } from './entities/order-item.entity';

type Calculable = Pick<OrderItem, 'qty' | 'unitPrice' | 'discountPercentage'>;

export type OrderTotals = {
  subtotal: number;
  discountTotal: number;
  total: number;
};

export function calculateTotals(items: Calculable[]): OrderTotals {
  let subtotal = 0;
  let discountTotal = 0;

  for (const item of items) {
    const discount = item.unitPrice - finalUnitPrice(item.unitPrice, item.discountPercentage);

    subtotal = round(subtotal + item.unitPrice * item.qty);
    discountTotal = round(discountTotal + discount * item.qty);
  }

  return { subtotal, discountTotal, total: round(subtotal - discountTotal) };
}

// desconto em centavo e ponto-base, inteiro, pra não arrastar erro de float pra dentro do
// arredondamento: 59.90 * 0.95 em double da 56.904999999999994, que arredonda pra 56.90 e
// come um centavo do cliente. em inteiro a conta é 5990 * 9500 / 10000 = 5690.5 -> 56.91
export function finalUnitPrice(unitPrice: number, discountPercentage: number | null): number {
  if (!discountPercentage) return round(unitPrice);

  const centavos = Math.round(unitPrice * 100);
  const fator = Math.round((100 - discountPercentage) * 100);

  return Math.round((centavos * fator) / 10_000) / 100;
}

// mesma regra do desconto: o total vira centavo inteiro antes de multiplicar pela taxa,
// pra taxa de 6 casas não arrastar erro de float pro arredondamento do centavo
export function convertTotal(total: number, rate: number): number {
  return Math.round(Math.round(total * 100) * rate) / 100;
}

// arredonda linha a linha porque a coluna é numeric(12,2). somando tudo e arredondando so no
// fim o total fecha diferente da soma das linhas e sobra centavo perdido na nota
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
