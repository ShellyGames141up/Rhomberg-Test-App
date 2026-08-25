import { products } from '../apps/api/src/data/catalogue.js';

const quote = value => `'${String(value).replaceAll("'", "''")}'`;

process.stdout.write([
  '-- Approved catalogue reference data only; no prices or operational records.',
  '-- Legitimate variants sometimes share a published family code. The stable product',
  '-- id remains unique while code is searchable but intentionally non-unique.',
  'ALTER TABLE app.products DROP CONSTRAINT products_code_key;',
  'CREATE INDEX products_code_idx ON app.products(code);',
  'INSERT INTO app.products (id,code,name,configuration_schema,is_active) VALUES',
  products.map((product, index) => `  (${quote(product.id)},${quote(product.code)},${quote(product.name)},${quote(JSON.stringify(product.configurations || []))}::jsonb,true)${index === products.length - 1 ? ';' : ','}`).join('\n'),
  '',
].join('\n'));
