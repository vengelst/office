/**
 * ZUGFeRD Comfort: bettet CII-XML in bestehendes Rechnungs-PDF ein (pdf-lib).
 * Hinweis: Vollständiges PDF/A-3 ist anspruchsvoll; wir liefern PDF + eingebettetes
 * factur-x.xml (EN 16931), das von vielen Empängern/ZUGFeRD-Readern gelesen wird.
 */

import { PDFDocument } from 'pdf-lib';

export async function embedZugferdXml(
  pdfBuffer: Buffer,
  ciiXml: string,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  await pdfDoc.attach(Buffer.from(ciiXml, 'utf8'), 'factur-x.xml', {
    mimeType: 'text/xml',
    description: 'Factur-X/ZUGFeRD EN 16931 invoice data',
    creationDate: new Date(),
    modificationDate: new Date(),
  });
  const out = await pdfDoc.save();
  return Buffer.from(out);
}
