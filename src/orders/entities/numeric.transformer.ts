import { ValueTransformer } from 'typeorm';

// o driver pg devolve numeric como string pra não perder precisão. sem isso
// subtotal + total vira concatenação de string em vez de soma
export const numericTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
