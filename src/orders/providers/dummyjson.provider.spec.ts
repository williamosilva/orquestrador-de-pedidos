import { isRetryable } from './dummyjson.provider';

describe('classificacao de erro do provedor', () => {
  it('trata resposta ausente como transitoria', () => {
    expect(isRetryable(undefined)).toBe(true);
  });

  it('retenta 429 e a familia 5xx', () => {
    expect(isRetryable(429)).toBe(true);
    expect(isRetryable(500)).toBe(true);
    expect(isRetryable(502)).toBe(true);
    expect(isRetryable(503)).toBe(true);
  });

  it('nao retenta sku inexistente nem erro de contrato', () => {
    expect(isRetryable(404)).toBe(false);
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable(401)).toBe(false);
    expect(isRetryable(422)).toBe(false);
  });

  it('nao retenta resposta de sucesso', () => {
    expect(isRetryable(200)).toBe(false);
  });
});
