export const ENRICHMENT_QUEUE = 'orders-enrichment';
export const ENRICHMENT_DLQ = 'orders-enrichment-dlq';

// contrato do job mora aqui porque é compartilhado entre quem publica e quem consome. fora do
// orderId ele leva so o correlation id: o resto o processor le do banco, que é a fonte de
// verdade. o correlation nao da pra ler de lugar nenhum, ele é o fio da meada entre o
// request que acabou e o worker que ainda vai rodar
export type EnrichmentJob = { orderId: string; correlationId: string };
