/**
 * Produktkatalog + Kundenpreise für Rechnungspositionen.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceProductDto } from './dto/create-invoice-product.dto';
import { UpdateInvoiceProductDto } from './dto/update-invoice-product.dto';
import { UpsertCustomerProductPriceDto } from './dto/upsert-customer-product-price.dto';

@Injectable()
export class InvoiceProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params?: { activeOnly?: boolean; search?: string }) {
    const where: Prisma.InvoiceProductWhereInput = {};
    if (params?.activeOnly) where.active = true;
    if (params?.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.invoiceProduct.findMany({
      where,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.invoiceProduct.findUnique({
      where: { id },
    });
    if (!product) throw new NotFoundException('Produkt nicht gefunden');
    return product;
  }

  async create(dto: CreateInvoiceProductDto) {
    return this.prisma.invoiceProduct.create({
      data: {
        code: dto.code?.trim() || null,
        name: dto.name.trim(),
        unit: dto.unit?.trim() || null,
        defaultUnitPrice: dto.defaultUnitPrice ?? 0,
        defaultTaxRate: dto.defaultTaxRate ?? null,
        active: dto.active ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateInvoiceProductDto) {
    await this.findOne(id);
    return this.prisma.invoiceProduct.update({
      where: { id },
      data: {
        code: dto.code === undefined ? undefined : dto.code?.trim() || null,
        name: dto.name === undefined ? undefined : dto.name.trim(),
        unit: dto.unit === undefined ? undefined : dto.unit?.trim() || null,
        defaultUnitPrice: dto.defaultUnitPrice,
        defaultTaxRate:
          dto.defaultTaxRate === undefined ? undefined : dto.defaultTaxRate,
        active: dto.active,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft: deaktivieren statt löschen, wenn schon auf Positionen referenziert
    const used = await this.prisma.invoiceLine.count({
      where: { productId: id },
    });
    if (used > 0) {
      return this.prisma.invoiceProduct.update({
        where: { id },
        data: { active: false },
      });
    }
    await this.prisma.invoiceProduct.delete({ where: { id } });
    return { id, deleted: true };
  }

  async listCustomerPrices(customerId: string) {
    await this.ensureCustomer(customerId);
    return this.prisma.customerProductPrice.findMany({
      where: { customerId },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            defaultUnitPrice: true,
            active: true,
          },
        },
      },
      orderBy: { product: { name: 'asc' } },
    });
  }

  async upsertCustomerPrice(
    customerId: string,
    dto: UpsertCustomerProductPriceDto,
  ) {
    await this.ensureCustomer(customerId);
    const product = await this.findOne(dto.productId);
    if (!product.active) {
      throw new BadRequestException('Produkt ist deaktiviert');
    }
    return this.prisma.customerProductPrice.upsert({
      where: {
        customerId_productId: {
          customerId,
          productId: dto.productId,
        },
      },
      create: {
        customerId,
        productId: dto.productId,
        unitPrice: dto.unitPrice,
      },
      update: { unitPrice: dto.unitPrice },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            defaultUnitPrice: true,
            active: true,
          },
        },
      },
    });
  }

  async removeCustomerPrice(customerId: string, productId: string) {
    await this.ensureCustomer(customerId);
    const row = await this.prisma.customerProductPrice.findUnique({
      where: {
        customerId_productId: { customerId, productId },
      },
    });
    if (!row) throw new NotFoundException('Kundenpreis nicht gefunden');
    await this.prisma.customerProductPrice.delete({ where: { id: row.id } });
    return { id: row.id, deleted: true };
  }

  /**
   * Liefert den effektiven Preis: Kundenpreis > Default.
   */
  async resolveUnitPrice(
    productId: string,
    customerId?: string | null,
  ): Promise<{
    product: {
      id: string;
      name: string;
      unit: string | null;
      defaultUnitPrice: number;
      defaultTaxRate: number | null;
    };
    unitPrice: number;
    fromCustomerPrice: boolean;
  }> {
    const product = await this.findOne(productId);
    if (customerId) {
      const cp = await this.prisma.customerProductPrice.findUnique({
        where: {
          customerId_productId: { customerId, productId },
        },
      });
      if (cp) {
        return {
          product,
          unitPrice: cp.unitPrice,
          fromCustomerPrice: true,
        };
      }
    }
    return {
      product,
      unitPrice: product.defaultUnitPrice,
      fromCustomerPrice: false,
    };
  }

  private async ensureCustomer(customerId: string): Promise<void> {
    const c = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Kunde nicht gefunden');
  }
}
