import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

class CustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;
}

class ItemDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsInt()
  @IsPositive()
  qty: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  unit_price: number;
}

// snake_case aqui porque esse é o contrato do emissor, nao o nosso. nao da pra pedir pro
// e-commerce mudar o payload, entao a traducao pro dominio fica no controller
export class ReceiveOrderDto {
  @IsString()
  @IsNotEmpty()
  order_id: string;

  @IsString()
  @IsNotEmpty()
  idempotency_key: string;

  // opcional de propósito: marketplace que não manda cai no ENRICHMENT_DEFAULT_SOURCE
  @ApiPropertyOptional({
    description:
      'provedor de enriquecimento; se omitido, usa o ENRICHMENT_DEFAULT_SOURCE do ambiente',
    example: 'dummyjson',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  source?: string;

  @IsString()
  @Length(3, 3)
  currency: string;

  @IsObject()
  @ValidateNested()
  @Type(() => CustomerDto)
  customer: CustomerDto;

  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];
}
