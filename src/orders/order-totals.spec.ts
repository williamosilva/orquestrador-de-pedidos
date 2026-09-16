import { calculateTotals, convertTotal, finalUnitPrice } from './order-totals';

function item(qty: number, unitPrice: number, discountPercentage: number | null = null) {
  return { qty, unitPrice, discountPercentage };
}

describe('calculateTotals', () => {
  it('soma o subtotal e repete no total qnd o pedido ainda nao foi enriquecido', () => {
    const totals = calculateTotals([item(2, 89.9), item(1, 129.9)]);

    expect(totals.subtotal).toBe(309.7);
    expect(totals.discountTotal).toBe(0);
    expect(totals.total).toBe(309.7);
  });

  it('aplica o desconto de afiliado por item e abate do total', () => {
    const totals = calculateTotals([item(2, 89.9, 10)]);

    expect(totals.subtotal).toBe(179.8);
    expect(totals.discountTotal).toBe(17.98);
    expect(totals.total).toBe(161.82);
  });

  it('desconta so o item que tem desconto qnd o pedido mistura os dois', () => {
    const totals = calculateTotals([item(1, 129.9, 15.5), item(3, 39.9)]);

    expect(totals.subtotal).toBe(249.6);
    expect(totals.discountTotal).toBe(20.13);
    expect(totals.total).toBe(229.47);
  });

  it('fecha o total como a soma das linhas arredondadas', () => {
    const totals = calculateTotals([item(3, 33.33, 7.5)]);

    expect(totals.total).toBe(totals.subtotal - totals.discountTotal);
  });

  it('nao mexe no preco qnd o item nao tem desconto', () => {
    expect(finalUnitPrice(89.9, null)).toBe(89.9);
    expect(finalUnitPrice(89.9, 0)).toBe(89.9);
  });

  it('arredonda meio centavo pra cima em vez de comer o centavo do cliente', () => {
    expect(finalUnitPrice(2.01, 50)).toBe(1.01);
    // 59.9 * 0.95 em float da 56.904999999999994 e arredondava pra baixo
    expect(finalUnitPrice(59.9, 5)).toBe(56.91);
    expect(finalUnitPrice(10.05, 50)).toBe(5.03);
  });

  it('converte o total pela taxa arredondando no centavo', () => {
    expect(convertTotal(107.24, 5.1512)).toBe(552.41);
    expect(convertTotal(100, 5)).toBe(500);
  });

  it('nao deixa a taxa de 6 casas arrastar erro pro centavo', () => {
    expect(convertTotal(19.99, 5.123456)).toBe(102.42);
  });
});
