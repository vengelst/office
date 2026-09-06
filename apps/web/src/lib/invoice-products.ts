/**
 * API-Helfer für Produktkatalog und Kundenpreise.
 */

import { apiClient } from './api-client';

export interface InvoiceProduct {
  id: string;
  code: string | null;
  name: string;
  unit: string | null;
  defaultUnitPrice: number;
  defaultTaxRate: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerProductPrice {
  id: string;
  customerId: string;
  productId: string;
  unitPrice: number;
  product: {
    id: string;
    code: string | null;
    name: string;
    unit: string | null;
    defaultUnitPrice: number;
    active: boolean;
  };
}

export interface CreateProductBody {
  code?: string;
  name: string;
  unit?: string;
  defaultUnitPrice?: number;
  defaultTaxRate?: number | null;
  active?: boolean;
}

export const invoiceProductsApi = {
  list: (params?: { activeOnly?: boolean; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.activeOnly) q.set('activeOnly', 'true');
    if (params?.search) q.set('search', params.search);
    const qs = q.toString();
    return apiClient.get<InvoiceProduct[]>(
      `/invoice-products${qs ? `?${qs}` : ''}`,
    );
  },
  create: (body: CreateProductBody) =>
    apiClient.post<InvoiceProduct>('/invoice-products', body),
  update: (id: string, body: Partial<CreateProductBody>) =>
    apiClient.patch<InvoiceProduct>(`/invoice-products/${id}`, body),
  remove: (id: string) =>
    apiClient.delete<unknown>(`/invoice-products/${id}`),
  resolvePrice: (productId: string, customerId?: string) => {
    const q = customerId
      ? `?customerId=${encodeURIComponent(customerId)}`
      : '';
    return apiClient.get<{
      product: InvoiceProduct;
      unitPrice: number;
      fromCustomerPrice: boolean;
    }>(`/invoice-products/${productId}/resolve-price${q}`);
  },
  listCustomerPrices: (customerId: string) =>
    apiClient.get<CustomerProductPrice[]>(
      `/customers/${customerId}/product-prices`,
    ),
  upsertCustomerPrice: (
    customerId: string,
    body: { productId: string; unitPrice: number },
  ) =>
    apiClient.put<CustomerProductPrice>(
      `/customers/${customerId}/product-prices`,
      body,
    ),
  removeCustomerPrice: (customerId: string, productId: string) =>
    apiClient.delete<unknown>(
      `/customers/${customerId}/product-prices/${productId}`,
    ),
};
