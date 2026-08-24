import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { createMemoryRepository } from '../src/repositories/memoryRepository.js';
import { createMemoryPrivateStorage } from '../src/storage/localPrivateStorage.js';
import { hashPassword } from '../src/security/crypto.js';

export const FABRICATED_PASSWORD = 'Fabricated-Phase1-Password!';
export const ids = Object.freeze({
  companyA: '10000000-0000-4000-8000-000000000001', companyB: '10000000-0000-4000-8000-000000000002',
  customerA: '20000000-0000-4000-8000-000000000001', customerB: '20000000-0000-4000-8000-000000000002', disabled: '20000000-0000-4000-8000-000000000003', representativeUser: '20000000-0000-4000-8000-000000000004',
  administrator: '20000000-0000-4000-8000-000000000005',
  representativeA: '30000000-0000-4000-8000-000000000001', representativeB: '30000000-0000-4000-8000-000000000002',
});

export async function createFixture({ configOverrides = {}, logger = false, logStream } = {}) {
  const passwordHash = await hashPassword(FABRICATED_PASSWORD);
  const repository = createMemoryRepository({
    companies: [{ id: ids.companyA, name: 'Fabricated Company A' }, { id: ids.companyB, name: 'Fabricated Company B' }],
    users: [
      { id: ids.customerA, email: 'customer.a@example.invalid', displayName: 'Fabricated Customer A', passwordHash, status: 'active', roles: ['customer'], permissions: ['create_rfq', 'view_own_company_rfqs', 'read_document_metadata'], companyIds: [ids.companyA] },
      { id: ids.customerB, email: 'customer.b@example.invalid', displayName: 'Fabricated Customer B', passwordHash, status: 'active', roles: ['customer'], permissions: ['create_rfq', 'view_own_company_rfqs', 'read_document_metadata'], companyIds: [ids.companyB] },
      { id: ids.disabled, email: 'disabled@example.invalid', displayName: 'Fabricated Disabled User', passwordHash, status: 'disabled', roles: ['customer'], permissions: ['create_rfq'], companyIds: [ids.companyA] },
      { id: ids.representativeUser, email: 'representative@example.invalid', displayName: 'Fabricated Representative', passwordHash, status: 'active', roles: ['sales_representative'], permissions: ['view_assigned_rfqs', 'read_document_metadata'], companyIds: [ids.companyA, ids.companyB], representativeId: ids.representativeA },
      { id: ids.administrator, username: 'fabricated-admin', email: 'fabricated.admin@example.invalid', displayName: 'Fabricated Administrator', passwordHash, status: 'active', roles: ['administrator'], permissions: ['view_all_rfqs', 'read_document_metadata', 'administer_users'], companyIds: [] },
    ],
    representatives: [
      { id: ids.representativeA, userId: ids.representativeUser, displayName: 'Fabricated Representative A', branchName: 'Fabricated Branch A', companyIds: [ids.companyA] },
      { id: ids.representativeB, userId: ids.representativeUser, displayName: 'Fabricated Representative B', branchName: 'Fabricated Branch B', companyIds: [ids.companyB] },
    ],
    products: [{ id: 'fabricated-pressure-gauge', code: 'DEMO-PG', name: 'Fabricated pressure gauge' }, { id: 'fabricated-temperature-gauge', code: 'DEMO-TG', name: 'Fabricated temperature gauge' }],
  });
  const storage = createMemoryPrivateStorage();
  const config = Object.freeze({ environment: 'test', host: '127.0.0.1', port: 0, logLevel: 'silent', trustProxy: false, cookieSecure: false, cookieName: 'rhomberg_test_session', sessionTtlSeconds: 3600, sessionPepper: 'fabricated-test-pepper-at-least-32-characters', maxUploadBytes: 4 * 1024 * 1024, allowedOrigins: [], identityMode: 'local_password', shutdownTimeoutMs: 1000, ...configOverrides });
  const app = await buildApp({ config, repository, storage, logger, logStream });
  return { app, repository, storage, config };
}

export async function login(app, email = 'customer.a@example.invalid', password = FABRICATED_PASSWORD, origin) {
  const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: origin ? { origin } : undefined, payload: { email, password } });
  const body = response.json();
  const cookie = response.headers['set-cookie']?.split(';')[0] || '';
  return { response, body, cookie, csrf: body.data?.csrfToken };
}

export const validRfq = (representativeId = ids.representativeA) => ({
  details: { application: 'Fabricated clean-water pressure monitoring', medium: 'Fabricated clean water', area: 'Fabricated Region', selectedRep: { id: representativeId }, fulfilment: 'delivery', deliveryAddress: '1 Fabricated Test Road', notes: 'Fabricated test request only.' },
  items: [{ lineId: randomUUID(), productId: 'fabricated-pressure-gauge', quantity: 2, configuration: { dialSize: '100 mm', range: '0 to 10 bar' } }],
});

export async function createRfq(app, auth, payload = validRfq(), key = `fabricated-${randomUUID()}`, origin) {
  return app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: { ...(origin ? { origin } : {}), cookie: auth.cookie, 'x-csrf-token': auth.csrf, 'idempotency-key': key }, payload });
}
