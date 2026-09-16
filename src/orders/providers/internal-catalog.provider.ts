import { Injectable } from '@nestjs/common';
import { EnrichedItem, EnrichmentError, EnrichmentProvider } from './enrichment-provider.interface';

const CATALOGO: Record<string, { productName: string; discountPercentage: number }> = {
  '1': { productName: 'Camiseta Preta Oversized', discountPercentage: 10 },
  '2': { productName: 'Caneca Térmica 500ml', discountPercentage: 5 },
  '3': { productName: 'Tênis Chunky Branco', discountPercentage: 15.5 },
  '4': { productName: 'Moletom Cinza Mescla', discountPercentage: 0 },
};

@Injectable()
export class InternalCatalogProvider implements EnrichmentProvider {
  supports(source: string): boolean {
    return source === 'internal-catalog';
  }

  async enrich(items: { sku: string }[]): Promise<EnrichedItem[]> {
    return items.map(({ sku }) => {
      const produto = CATALOGO[sku.replace('IC-', '')];

      if (!produto) throw new EnrichmentError(`sku ${sku} nao existe no catalogo local`, false);

      return { sku, ...produto };
    });
  }
}
