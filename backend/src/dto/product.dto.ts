import { IsString, IsNumber, IsOptional, IsArray, IsEnum, Min, Max, Length, ArrayMaxSize, IsUrl, IsObject } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ProductStatus } from '../types';
import { sanitizeXSS, sanitizeRichText } from '../utils/sanitize';

/**
 * 创建商品DTO
 */
export class CreateProductDto {
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => sanitizeXSS(value))
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  @Transform(({ value }) => value ? sanitizeRichText(value) : value)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  images?: string[];

  @IsNumber()
  @Min(0)
  @Max(99999999.99)
  @Type(() => Number)
  starting_price!: number;

  @IsNumber()
  @Min(0.01)
  @Max(999999.99)
  @Type(() => Number)
  price_increment!: number;

  @IsNumber()
  @Min(1)
  @Max(1440) // 最长24小时
  @Type(() => Number)
  duration!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(99999999.99)
  @Type(() => Number)
  cap_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(30)
  @Type(() => Number)
  delay_time?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  category_id?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999999)
  @Type(() => Number)
  stock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999999)
  @Type(() => Number)
  stock_warning?: number;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  @Transform(({ value }) => value ? sanitizeXSS(value) : value)
  sku?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999.99)
  @Type(() => Number)
  weight?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  shipping_template_id?: number;

  @IsOptional()
  @IsObject()
  specifications?: Record<string, string>;
}

/**
 * 更新商品DTO
 */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => sanitizeXSS(value))
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  @Transform(({ value }) => value ? sanitizeRichText(value) : value)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  images?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999.99)
  @Type(() => Number)
  starting_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(999999.99)
  @Type(() => Number)
  price_increment?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  @Type(() => Number)
  duration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(99999999.99)
  @Type(() => Number)
  cap_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(30)
  @Type(() => Number)
  delay_time?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  category_id?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999999)
  @Type(() => Number)
  stock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999999)
  @Type(() => Number)
  stock_warning?: number;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  @Transform(({ value }) => value ? sanitizeXSS(value) : value)
  sku?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999.99)
  @Type(() => Number)
  weight?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  shipping_template_id?: number;

  @IsOptional()
  @IsObject()
  specifications?: Record<string, string>;
}

/**
 * 商品状态更新DTO
 */
export class UpdateProductStatusDto {
  @IsEnum(['pending', 'active', 'completed', 'cancelled'])
  status!: ProductStatus;
}

/**
 * 商品查询DTO
 */
export class ProductQueryDto {
  @IsOptional()
  @IsString()
  @Length(0, 100)
  @Transform(({ value }) => value ? sanitizeXSS(value) : value)
  search?: string;

  @IsOptional()
  @IsEnum(['pending', 'active', 'completed', 'cancelled'])
  status?: ProductStatus;

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

  @IsOptional()
  @IsString()
  @IsEnum(['created_at', 'starting_price', 'name'])
  sort?: string;

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC';

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  category_id?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value ? sanitizeXSS(value) : value)
  tag?: string;
}

/**
 * 商品响应DTO
 */
export class ProductResponseDto {
  id!: number;
  merchant_id!: number;
  name!: string;
  description?: string;
  images?: string[];
  starting_price!: number;
  price_increment!: number;
  duration!: number;
  cap_price?: number;
  delay_time!: number;
  status!: ProductStatus;
  stock!: number;
  stock_warning!: number;
  sku?: string;
  weight?: number;
  shipping_template_id?: number;
  specifications?: Record<string, string>;
  created_at!: Date;
  updated_at!: Date;
  merchant?: {
    id: number;
    username: string;
    avatar?: string | null;
  };
  auction?: {
    id: number;
    status: string;
    current_price?: number;
    end_time?: Date;
  };
  category_id?: number;
  tags?: string[];
  category?: {
    id: number;
    name: string;
    icon?: string | null;
  };
  shipping_template?: {
    id: number;
    name: string;
  };
}

/**
 * XSS防护函数
 */
export function isValidStatusTransition(currentStatus: ProductStatus, newStatus: ProductStatus): boolean {
  const validTransitions: Record<ProductStatus, ProductStatus[]> = {
    pending: ['active', 'cancelled'],
    active: ['completed', 'cancelled'],
    completed: [],
    cancelled: ['pending'],
  };

  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * 检查商品是否可以编辑/删除
 */
export function canEditOrDelete(productStatus: ProductStatus): boolean {
  // 只有pending状态的商品可以编辑/删除
  return productStatus === 'pending';
}