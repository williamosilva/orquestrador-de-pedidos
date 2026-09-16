import { AsyncLocalStorage } from 'async_hooks';

const store = new AsyncLocalStorage<string>();

// o pino-http já guarda o logger do request num AsyncLocalStorage próprio, mas worker de
// fila não tem request nenhum. esse store é o equivalente pro lado assíncrono: o worker
// abre o contexto com o id que veio no job e quem loga lá dentro acha sem receber parâmetro
export function runWithCorrelation<T>(correlationId: string, fn: () => T): T {
  return store.run(correlationId, fn);
}

export function currentCorrelationId(): string | undefined {
  return store.getStore();
}
