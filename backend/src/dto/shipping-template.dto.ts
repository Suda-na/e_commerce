import { IsString, IsNumber, IsOptional, IsArray, Min, Max, Length, ValidateNested, ArrayMinSize, IsObject } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { IShippingRule, IShippingTemplate } from '../types';
import { sanitizeXSS } from '../utils/sanitize';

export class ShippingRuleDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  regions!: string[];

  @IsNumber()
  @Min(0)
  @Max(999999.99)
  @Type(() => Number)
  first_item_fee!: number;

  @IsNumber()
  @Min(0)
  @Max(999999.99)
  @Type(() => Number)
  additional_item_fee!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999.99)
  @Type(() => Number)
  free_threshold?: number | null;
}

export class CreateShippingTemplateDto {
  @IsString()
  @Length(1, 100)
  @Transform(({ value }) => sanitizeXSS(value))
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingRuleDto)
  rules!: ShippingRuleDto[];
}

export class UpdateShippingTemplateDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Transform(({ value }) => value ? sanitizeXSS(value) : value)
  name?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingRuleDto)
  rules?: ShippingRuleDto[];
}

export class ShippingTemplateQueryDto {
  @IsOptional()
  @IsString()
  @Length(0, 100)
  @Transform(({ value }) => value ? sanitizeXSS(value) : value)
  search?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;
}

export class CalculateShippingFeeDto {
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  template_id!: number;

  @IsString()
  @Length(1, 50)
  @Transform(({ value }) => sanitizeXSS(value))
  region!: string;

  @IsNumber()
  @Min(1)
  @Max(99999)
  @Type(() => Number)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  total_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  weight?: number;
}

export interface ShippingTemplateResponseDto {
  id: number;
  merchant_id: number;
  name: string;
  rules: ShippingRuleResponseDto[];
  created_at: Date;
  updated_at: Date;
}

export interface ShippingRuleResponseDto {
  id: number;
  template_id: number;
  regions: string[];
  first_item_fee: number;
  additional_item_fee: number;
  free_threshold?: number | null;
}
