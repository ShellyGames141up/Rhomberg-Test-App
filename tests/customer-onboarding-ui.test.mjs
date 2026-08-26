import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const read = path => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('API staging exposes customer account creation through the service boundary', async () => {
  const [app, auth, api] = await Promise.all([
    read('src/App.jsx'), read('src/components/Auth.jsx'), read('src/services/api/createApiServices.js'),
  ]);
  assert.match(app, /allowRegistration=\{\(services\.mode === 'api' && !__PUBLIC_PREVIEW__\)/);
  assert.match(auth, /Create customer account/);
  assert.match(api, /client\.post\('\/auth\/register'/);
  assert.doesNotMatch(api, /localStorage/);
});

test('RFQ UI distinguishes first selection from the read-only company relationship', async () => {
  const enquiry = await read('src/components/Enquiry.jsx');
  assert.match(enquiry, /representativeAssignmentStatus/);
  assert.match(enquiry, /dedicated representative/i);
  assert.match(enquiry, /existing RFQs keep their original assigned Representative/i);
});
