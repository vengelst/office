/**
 * Erzeugt XRechnung-konformes UBL 2.1 Invoice XML (EN 16931 Kernfelder).
 */

import type { En16931Invoice } from './en16931.model';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n: number): string {
  return n.toFixed(2);
}

/**
 * UBL Invoice XML (XRechnung 3.x kompatible Kernstruktur).
 */
export function generateXRechnungUbl(doc: En16931Invoice): string {
  const vatGroups = new Map<number, { taxable: number; tax: number }>();
  for (const line of doc.lines) {
    const g = vatGroups.get(line.vatPercent) ?? { taxable: 0, tax: 0 };
    g.taxable += line.netAmount;
    g.tax += (line.netAmount * line.vatPercent) / 100;
    vatGroups.set(line.vatPercent, g);
  }

  const taxTotalXml = [...vatGroups.entries()]
    .map(
      ([rate, g]) => `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${esc(doc.currency)}">${money(g.taxable)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${esc(doc.currency)}">${money(g.tax)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${rate === 0 ? 'Z' : 'S'}</cbc:ID>
        <cbc:Percent>${money(rate)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`,
    )
    .join('');

  const linesXml = doc.lines
    .map(
      (l) => `
  <cac:InvoiceLine>
    <cbc:ID>${esc(l.id)}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${esc(l.unitCode)}">${money(l.quantity)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${esc(doc.currency)}">${money(l.netAmount)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${esc(l.name)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${l.vatPercent === 0 ? 'Z' : 'S'}</cbc:ID>
        <cbc:Percent>${money(l.vatPercent)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${esc(doc.currency)}">${money(l.netUnitPrice)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`,
    )
    .join('');

  const buyerRef = doc.buyer.buyerReference
    ? `<cbc:BuyerReference>${esc(doc.buyer.buyerReference)}</cbc:BuyerReference>`
    : `<cbc:BuyerReference>${esc(doc.invoiceNumber)}</cbc:BuyerReference>`;

  const sellerStreet = doc.seller.street
    ? `<cbc:StreetName>${esc(doc.seller.street)}</cbc:StreetName>`
    : '';
  const buyerStreet = doc.buyer.street
    ? `<cbc:StreetName>${esc(doc.buyer.street)}</cbc:StreetName>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${esc(doc.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${esc(doc.issueDate)}</cbc:IssueDate>
  ${doc.dueDate ? `<cbc:DueDate>${esc(doc.dueDate)}</cbc:DueDate>` : ''}
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  ${doc.note ? `<cbc:Note>${esc(doc.note)}</cbc:Note>` : ''}
  <cbc:DocumentCurrencyCode>${esc(doc.currency)}</cbc:DocumentCurrencyCode>
  ${buyerRef}
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${esc(doc.seller.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        ${sellerStreet}
        ${doc.seller.city ? `<cbc:CityName>${esc(doc.seller.city)}</cbc:CityName>` : ''}
        ${doc.seller.postalCode ? `<cbc:PostalZone>${esc(doc.seller.postalCode)}</cbc:PostalZone>` : ''}
        <cac:Country><cbc:IdentificationCode>${esc(doc.seller.countryCode)}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(doc.seller.vatId ?? '')}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(doc.seller.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      ${
        doc.seller.email
          ? `<cac:Contact><cbc:ElectronicMail>${esc(doc.seller.email)}</cbc:ElectronicMail></cac:Contact>`
          : ''
      }
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${esc(doc.buyer.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        ${buyerStreet}
        ${doc.buyer.city ? `<cbc:CityName>${esc(doc.buyer.city)}</cbc:CityName>` : ''}
        ${doc.buyer.postalCode ? `<cbc:PostalZone>${esc(doc.buyer.postalCode)}</cbc:PostalZone>` : ''}
        <cac:Country><cbc:IdentificationCode>${esc(doc.buyer.countryCode)}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${
        doc.buyer.vatId
          ? `<cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(doc.buyer.vatId)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`
          : ''
      }
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(doc.buyer.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      ${
        doc.buyer.email
          ? `<cac:Contact><cbc:ElectronicMail>${esc(doc.buyer.email)}</cbc:ElectronicMail></cac:Contact>`
          : ''
      }
    </cac:Party>
  </cac:AccountingCustomerParty>
  ${
    doc.seller.iban
      ? `<cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${esc(doc.seller.iban.replace(/\s+/g, ''))}</cbc:ID>
      ${doc.seller.bic ? `<cac:FinancialInstitutionBranch><cbc:ID>${esc(doc.seller.bic)}</cbc:ID></cac:FinancialInstitutionBranch>` : ''}
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`
      : ''
  }
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${esc(doc.currency)}">${money(doc.vatTotal)}</cbc:TaxAmount>
    ${taxTotalXml}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${esc(doc.currency)}">${money(doc.netTotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${esc(doc.currency)}">${money(doc.netTotal)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${esc(doc.currency)}">${money(doc.grossTotal)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${esc(doc.currency)}">${money(doc.grossTotal)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${linesXml}
</Invoice>
`;
}

/**
 * Cross-Industry Invoice (CII) XML für ZUGFeRD Comfort / EN 16931.
 */
export function generateCiiXml(doc: En16931Invoice): string {
  const linesXml = doc.lines
    .map(
      (l, i) => `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>${esc(l.name)}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice><ram:ChargeAmount>${money(l.netUnitPrice)}</ram:ChargeAmount></ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${esc(l.unitCode)}">${money(l.quantity)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${l.vatPercent === 0 ? 'Z' : 'S'}</ram:CategoryCode>
          <ram:RateApplicablePercent>${money(l.vatPercent)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${money(l.netAmount)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`,
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(doc.invoiceNumber)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${esc(doc.issueDate.replace(/-/g, ''))}</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    ${linesXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${esc(doc.buyer.buyerReference || doc.invoiceNumber)}</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>${esc(doc.seller.name)}</ram:Name>
        <ram:PostalTradeAddress>
          ${doc.seller.street ? `<ram:LineOne>${esc(doc.seller.street)}</ram:LineOne>` : ''}
          ${doc.seller.postalCode ? `<ram:PostcodeCode>${esc(doc.seller.postalCode)}</ram:PostcodeCode>` : ''}
          ${doc.seller.city ? `<ram:CityName>${esc(doc.seller.city)}</ram:CityName>` : ''}
          <ram:CountryID>${esc(doc.seller.countryCode)}</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${esc(doc.seller.vatId ?? '')}</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(doc.buyer.name)}</ram:Name>
        <ram:PostalTradeAddress>
          ${doc.buyer.street ? `<ram:LineOne>${esc(doc.buyer.street)}</ram:LineOne>` : ''}
          ${doc.buyer.postalCode ? `<ram:PostcodeCode>${esc(doc.buyer.postalCode)}</ram:PostcodeCode>` : ''}
          ${doc.buyer.city ? `<ram:CityName>${esc(doc.buyer.city)}</ram:CityName>` : ''}
          <ram:CountryID>${esc(doc.buyer.countryCode)}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${
          doc.buyer.vatId
            ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(doc.buyer.vatId)}</ram:ID></ram:SpecifiedTaxRegistration>`
            : ''
        }
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${esc(doc.currency)}</ram:InvoiceCurrencyCode>
      ${
        doc.seller.iban
          ? `<ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${esc(doc.seller.iban.replace(/\s+/g, ''))}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>`
          : ''
      }
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${money(doc.vatTotal)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${money(doc.netTotal)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${money(doc.netTotal)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${money(doc.netTotal)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${esc(doc.currency)}">${money(doc.vatTotal)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${money(doc.grossTotal)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${money(doc.grossTotal)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
}
