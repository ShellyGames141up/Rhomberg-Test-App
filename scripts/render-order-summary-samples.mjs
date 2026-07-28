import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import {
  buildOrderSummaryModel,
  generateOrderSummaryPdf,
  ORDER_COPY_TYPES,
} from '../src/domain/orderDocuments.js';
import { DEMO_ENQUIRIES } from '../src/services/mock/seedData.js';

const outputDirectory = path.resolve('tmp/pdfs');
await mkdir(outputDirectory, { recursive: true });
const order = DEMO_ENQUIRIES.find(item => item.reference === 'OR-TEST-0012');
if (!order) throw new Error('The fabricated PDF sample order could not be found.');

for (const copyType of Object.values(ORDER_COPY_TYPES)) {
  const model = buildOrderSummaryModel({
    order,
    copyType,
    generatedAt: '2026-07-28T14:30:00.000Z',
    generatedBy: 'PDF Layout Verification',
  });
  const base64 = await generateOrderSummaryPdf(model);
  const bytes = Buffer.from(base64, 'base64');
  const pdf = await PDFDocument.load(bytes);
  const filePath = path.join(outputDirectory, `OR-TEST-0012-${copyType}-sample.pdf`);
  await writeFile(filePath, bytes);
  console.log(`${filePath} | ${pdf.getPageCount()} pages | ${bytes.length} bytes`);
}
