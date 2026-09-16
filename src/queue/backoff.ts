const BASE_MS = 2000;
const JITTER_MS = 1000;

// 2s / 4s / 8s mais um jitter de até 1s. sem o jitter, uma queda do provedor faz os jobs
// falharem no mesmo instante e voltarem todos juntos, batendo de novo no que caiu
export function backoffWithJitter(attemptsMade: number): number {
  return Math.round(BASE_MS * 2 ** (attemptsMade - 1) + Math.random() * JITTER_MS);
}
