/**
 * XRechnung UBL 2.1 XML-Generator (EN 16931 / XRechnung 3.x Profile).
 */

import type { En16931Invoice } from './en16931.model';

function esc(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n: number): string {
  return n.toFixed(2);
}

/**
 * Erzeugt XRechnung-konformes UBL Invoice XML.
 */
export function generateXRechnungXml(model: En16931Invoice): string {
  const customizationId =
    'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0';
  const profileId =
    'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';

  const taxSubtotals = model.taxBreakdown
    .map(
      (t) => `
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${esc(model.currencyCode)}">${money(t.taxableAmount)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${esc(model.currencyCode)}">${money(t.taxAmount)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>${esc(t.taxCategory)}</cbc:ID>
          <cbc:Percent>${money(t.taxPercent)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`,
    )
    .join('');

  const lines = model.lines
    .map(
      (l) => `
  <cac:InvoiceLine>
    <cbc:ID>${esc(String(l.position))}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${esc(l.unitCode)}">${esc(l.quantity)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${esc(model.currencyCode)}">${money(l.netAmount)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${esc(l.name)}</cbc:Name>
      ${l.description ? `<cbc:Description>${esc(l.description)}</cbc:Description>` : ''}
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${esc(l.taxCategory)}</cbc:ID>
        <cbc:Percent>${money(l.taxPercent)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${esc(model.currencyCode)}">${money(l.unitPrice)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`,
    )
    .join('');

  const buyerRef =
    model.buyerReference || model.buyer.buyerReference
      ? `<cbc:BuyerReference>${esc(model.buyerReference || model.buyer.buyerReference)}</cbc:BuyerReference>`
      : '<cbc:BuyerReference>N/A</cbc:BuyerReference>';

  const sellerVat = model.seller.vatId
    ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(model.seller.vatId)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`
    : '';

  const buyerVat = model.buyer.vatId
    ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(model.buyer.vatId)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`
    : '';

  const payment =
    model.paymentMeans?.iban
      ? `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${esc(model.paymentMeans.paymentMeansCode ?? '30')}</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${esc(model.paymentMeans.iban)}</cbc:ID>
      ${model.paymentMeans.accountName ? `<cbc:Name>${esc(model.paymentMeans.accountName)}</cbc:Name>` : ''}
      ${
        model.paymentMeans.bic
          ? `<cac:FinancialInstitutionBranch><cbc:ID>${esc(model.paymentMeans.bic)}</cbc:ID></cac:FinancialInstitutionBranch>`
          : ''
      }
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`
      : '';

  const period =
    model.periodFrom && model.periodTo
      ? `
  <cac:InvoicePeriod>
    <cbc:StartDate>${esc(model.periodFrom)}</cbc:StartDate>
    <cbc:EndDate>${esc(model.periodTo)}</cbc:EndDate>
  </cac:InvoicePeriod>`
      : '';

  const billingRef = model.precedingInvoiceNumber
    ? `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${esc(model.precedingInvoiceNumber)}</cbc:ID>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>${esc(customizationId)}</cbc:CustomizationID>
  <cbc:ProfileID>${esc(profileId)}</cbc:ProfileID>
  <cbc:ID>${esc(model.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${esc(model.issueDate)}</cbc:IssueDate>
  ${model.dueDate ? `<cbc:DueDate>${esc(model.dueDate)}</cbc:DueDate>` : ''}
  <cbc:InvoiceTypeCode>${esc(model.typeCode)}</cbc:InvoiceTypeCode>
  ${model.note ? `<cbc:Note>${esc(model.note)}</cbc:Note>` : ''}
  <cbc:DocumentCurrencyCode>${esc(model.currencyCode)}</cbc:DocumentCurrencyCode>
  ${buyerRef}
  ${period}
  ${billingRef}
  <cac:AccountingSupplierParty>
    <cac:Party>
      ${
        model.seller.electronicAddress
          ? `<cbc:EndpointID schemeID="${esc(model.seller.electronicAddressScheme ?? 'EM')}">${esc(model.seller.electronicAddress)}</cbc:EndpointID>`
          : ''
      }
      <cac:PartyName><cbc:Name>${esc(model.seller.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(model.seller.address.line1)}</cbc:StreetName>
        ${model.seller.address.line2 ? `<cbc:AdditionalStreetName>${esc(model.seller.address.line2)}</cbc:AdditionalStreetName>` : ''}
        <cbc:CityName>${esc(model.seller.address.city)}</cbc:CityName>
        <cbc:PostalZone>${esc(model.seller.address.postalCode)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${esc(model.seller.address.countryCode)}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${sellerVat}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(model.seller.name)}</cbc:RegistrationName>
        ${model.seller.taxNumber ? `<cbc:CompanyID>${esc(model.seller.taxNumber)}</cbc:CompanyID>` : ''}
      </cac:PartyLegalEntity>
      ${
        model.seller.contactEmail || model.seller.contactPhone
          ? `<cac:Contact>
        ${model.seller.contactEmail ? `<cbc:ElectronicMail>${esc(model.seller.contactEmail)}</cbc:ElectronicMail>` : ''}
        ${model.seller.contactPhone ? `<cbc:Telephone>${esc(model.seller.contactPhone)}</cbc:Telephone>` : ''}
      </cac:Contact>`
          : ''
      }
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      ${
        model.buyer.electronicAddress
          ? `<cbc:EndpointID schemeID="${esc(model.buyer.electronicAddressScheme ?? 'EM')}">${esc(model.buyer.electronicAddress)}</cbc:EndpointID>`
          : `<cbc:EndpointID schemeID="EM">keine@angabe.local</cbc:EndpointID>`
      }
      <cac:PartyName><cbc:Name>${esc(model.buyer.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(model.buyer.address.line1)}</cbc:StreetName>
        ${model.buyer.address.line2 ? `<cbc:AdditionalStreetName>${esc(model.buyer.address.line2)}</cbc:AdditionalStreetName>` : ''}
        <cbc:CityName>${esc(model.buyer.address.city)}</cbc:CityName>
        <cbc:PostalZone>${esc(model.buyer.address.postalCode)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${esc(model.buyer.address.countryCode)}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${buyerVat}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(model.buyer.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  ${payment}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${esc(model.currencyCode)}">${money(model.taxTotal)}</cbc:TaxAmount>
    ${taxSubtotals}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${esc(model.currencyCode)}">${money(model.lineNetTotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${esc(model.currencyCode)}">${money(model.lineNetTotal)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${esc(model.currencyCode)}">${money(model.grandTotal)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${esc(model.currencyCode)}">${money(model.amountDue)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lines}
</Invoice>
`;
}
