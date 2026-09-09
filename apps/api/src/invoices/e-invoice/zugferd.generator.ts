/**
 * ZUGFeRD / Factur-X CII XML (EN 16931 Comfort) Generator.
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
 * Erzeugt Cross-Industry-Invoice XML für ZUGFeRD 2.2 Comfort / Factur-X EN16931.
 */
export function generateCiiXml(model: En16931Invoice): string {
  const guideline =
    'urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:en16931';

  const tradeTax = model.taxBreakdown
    .map(
      (t) => `
            <ram:ApplicableTradeTax>
              <ram:CalculatedAmount>${money(t.taxAmount)}</ram:CalculatedAmount>
              <ram:TypeCode>VAT</ram:TypeCode>
              <ram:CategoryCode>${esc(t.taxCategory)}</ram:CategoryCode>
              <ram:RateApplicablePercent>${money(t.taxPercent)}</ram:RateApplicablePercent>
              <ram:BasisAmount>${money(t.taxableAmount)}</ram:BasisAmount>
            </ram:ApplicableTradeTax>`,
    )
    .join('');

  const lines = model.lines
    .map(
      (l, idx) => `
        <ram:IncludedSupplyChainTradeLineItem>
          <ram:AssociatedDocumentLineDocument>
            <ram:LineID>${esc(String(l.position || idx + 1))}</ram:LineID>
          </ram:AssociatedDocumentLineDocument>
          <ram:SpecifiedTradeProduct>
            <ram:Name>${esc(l.name)}</ram:Name>
            ${l.description ? `<ram:Description>${esc(l.description)}</ram:Description>` : ''}
          </ram:SpecifiedTradeProduct>
          <ram:SpecifiedLineTradeAgreement>
            <ram:NetPriceProductTradePrice>
              <ram:ChargeAmount>${money(l.unitPrice)}</ram:ChargeAmount>
            </ram:NetPriceProductTradePrice>
          </ram:SpecifiedLineTradeAgreement>
          <ram:SpecifiedLineTradeDelivery>
            <ram:BilledQuantity unitCode="${esc(l.unitCode)}">${esc(l.quantity)}</ram:BilledQuantity>
          </ram:SpecifiedLineTradeDelivery>
          <ram:SpecifiedLineTradeSettlement>
            <ram:ApplicableTradeTax>
              <ram:TypeCode>VAT</ram:TypeCode>
              <ram:CategoryCode>${esc(l.taxCategory)}</ram:CategoryCode>
              <ram:RateApplicablePercent>${money(l.taxPercent)}</ram:RateApplicablePercent>
            </ram:ApplicableTradeTax>
            <ram:SpecifiedTradeSettlementLineMonetarySummation>
              <ram:LineTotalAmount>${money(l.netAmount)}</ram:LineTotalAmount>
            </ram:SpecifiedTradeSettlementLineMonetarySummation>
          </ram:SpecifiedLineTradeSettlement>
        </ram:IncludedSupplyChainTradeLineItem>`,
    )
    .join('');

  const buyerRef =
    model.buyerReference || model.buyer.buyerReference
      ? `<ram:BuyerReference>${esc(model.buyerReference || model.buyer.buyerReference)}</ram:BuyerReference>`
      : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${esc(guideline)}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(model.invoiceNumber)}</ram:ID>
    <ram:TypeCode>${esc(model.typeCode)}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${esc(model.issueDate.replace(/-/g, ''))}</udt:DateTimeString>
    </ram:IssueDateTime>
    ${model.note ? `<ram:IncludedNote><ram:Content>${esc(model.note)}</ram:Content></ram:IncludedNote>` : ''}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    ${lines}
    <ram:ApplicableHeaderTradeAgreement>
      ${buyerRef}
      <ram:SellerTradeParty>
        <ram:Name>${esc(model.seller.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(model.seller.address.postalCode)}</ram:PostcodeCode>
          <ram:LineOne>${esc(model.seller.address.line1)}</ram:LineOne>
          <ram:CityName>${esc(model.seller.address.city)}</ram:CityName>
          <ram:CountryID>${esc(model.seller.address.countryCode)}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${
          model.seller.vatId
            ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(model.seller.vatId)}</ram:ID></ram:SpecifiedTaxRegistration>`
            : ''
        }
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(model.buyer.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(model.buyer.address.postalCode)}</ram:PostcodeCode>
          <ram:LineOne>${esc(model.buyer.address.line1)}</ram:LineOne>
          <ram:CityName>${esc(model.buyer.address.city)}</ram:CityName>
          <ram:CountryID>${esc(model.buyer.address.countryCode)}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${
          model.buyer.vatId
            ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(model.buyer.vatId)}</ram:ID></ram:SpecifiedTaxRegistration>`
            : ''
        }
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${esc(model.currencyCode)}</ram:InvoiceCurrencyCode>
      ${
        model.paymentMeans?.iban
          ? `<ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>${esc(model.paymentMeans.paymentMeansCode ?? '30')}</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${esc(model.paymentMeans.iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
        ${
          model.paymentMeans.bic
            ? `<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${esc(model.paymentMeans.bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>`
            : ''
        }
      </ram:SpecifiedTradeSettlementPaymentMeans>`
          : ''
      }
      ${tradeTax}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${money(model.lineNetTotal)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${money(model.lineNetTotal)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${esc(model.currencyCode)}">${money(model.taxTotal)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${money(model.grandTotal)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${money(model.amountDue)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
}
