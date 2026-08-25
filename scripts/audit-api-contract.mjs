import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendFile = path.join(root, 'src/services/api/createApiServices.js');
const backendFile = path.join(root, 'apps/api/src/app.js');

const normaliseExpressionName = expression => {
  const value = expression.trim().replace(/^encodeURIComponent\((.*)\)$/s, '$1').trim();
  return value.split('.').at(-1).replace(/[^a-zA-Z0-9_]/g, '') || 'value';
};

const normaliseTemplate = value => value.replace(/\$\{([^}]+)\}/g, (_match, expression) => `:${normaliseExpressionName(expression)}`);

function readStringArgument(source, start) {
  let index = start;
  while (/\s/.test(source[index] || '')) index += 1;
  const quote = source[index];
  if (!['\'', '"', '`'].includes(quote)) return null;
  let value = '';
  let templateDepth = 0;
  for (index += 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === '\\') {
      value += character + (source[index + 1] || '');
      index += 1;
      continue;
    }
    if (quote === '`' && character === '$' && source[index + 1] === '{') {
      templateDepth += 1;
      value += '${';
      index += 1;
      continue;
    }
    if (quote === '`' && templateDepth && character === '}') {
      templateDepth -= 1;
      value += character;
      continue;
    }
    if (character === quote && templateDepth === 0) return value;
    value += character;
  }
  return null;
}

const expandDynamicResource = route => route.includes('/:resource/')
  ? ['enquiries', 'orders'].map(resource => route.replace('/:resource/', `/${resource}/`))
  : [route];

export function extractFrontendRoutes(source) {
  const routes = [];
  const matcher = /client\.(get|post|put|patch|delete)\s*\(/g;
  for (const match of source.matchAll(matcher)) {
    const rawPath = readStringArgument(source, match.index + match[0].length);
    if (!rawPath) continue;
    const route = normaliseTemplate(rawPath);
    for (const expanded of expandDynamicResource(route)) routes.push({ method: match[1].toUpperCase(), path: expanded });
  }
  return [...new Map(routes.map(route => [`${route.method} ${route.path}`, route])).values()]
    .sort((left, right) => `${left.path} ${left.method}`.localeCompare(`${right.path} ${right.method}`));
}

export function extractBackendRoutes(source) {
  const routes = [];
  const matcher = /app\.(get|post|put|patch|delete)\s*\(\s*(['"])([^'"]+)\2/g;
  for (const match of source.matchAll(matcher)) routes.push({ method: match[1].toUpperCase(), path: match[3] });
  return [...new Map(routes.map(route => [`${route.method} ${route.path}`, route])).values()]
    .sort((left, right) => `${left.path} ${left.method}`.localeCompare(`${right.path} ${right.method}`));
}

const publicRoutes = new Set([
  'GET /auth/csrf-token',
  'POST /auth/login',
  'POST /auth/register',
  'GET /products/categories',
  'GET /products',
  'GET /products/recommendations',
  'GET /products/:productId',
  'GET /reference-data/registration',
]);

const priorityZero = new Set([
  'GET /auth/csrf-token', 'POST /auth/login', 'GET /auth/me',
  'GET /products/categories', 'GET /products', 'GET /products/recommendations',
  'GET /reference-data/registration', 'GET /enquiries', 'GET /orders',
  'GET /notifications', 'GET /users/me/notification-preferences',
  'GET /users/me/settings', 'GET /administration/overview',
]);

const routeMatches = (frontend, backend) => {
  if (frontend.method !== backend.method) return false;
  const frontendSegments = frontend.path.split('/');
  const backendSegments = backend.path.replace('/api/v1', '').split('/');
  return frontendSegments.length === backendSegments.length && frontendSegments.every((segment, index) => (
    segment === backendSegments[index]
    || (segment.startsWith(':') && backendSegments[index].startsWith(':'))
  ));
};

export function createContractAudit(frontendRoutes, backendRoutes) {
  const apiBackendRoutes = backendRoutes.filter(route => route.path.startsWith('/api/v1/'));
  const matrix = frontendRoutes.map(route => {
    const key = `${route.method} ${route.path}`;
    const implemented = apiBackendRoutes.some(candidate => routeMatches(route, candidate));
    const isPublic = publicRoutes.has(key) || (route.method === 'GET' && route.path === '/products/:productId');
    const clientTransportIncompatible = route.method === 'PATCH';
    return {
      ...route,
      authentication: isPublic ? 'public approved reference/auth route' : 'authenticated session',
      csrf: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.method) && !['POST /auth/login', 'POST /auth/register'].includes(key) ? 'required' : 'not required',
      status: implemented ? 'implemented' : clientTransportIncompatible ? 'incompatible' : 'missing',
      priority: priorityZero.has(key) ? 'P0' : route.method === 'GET' ? 'P1' : 'P2',
    };
  });
  return { frontendRoutes, backendRoutes, apiBackendRoutes, matrix };
}

const escapeCell = value => String(value).replaceAll('|', '\\|');

export function renderContractAudit(audit) {
  const implemented = audit.matrix.filter(route => route.status === 'implemented').length;
  const incompatible = audit.matrix.filter(route => route.status === 'incompatible').length;
  const missing = audit.matrix.length - implemented - incompatible;
  return [
    '# API-mode frontend/backend contract audit',
    '',
    'Generated from `src/services/api/createApiServices.js` and `apps/api/src/app.js`.',
    '',
    `- Unique frontend API contracts: **${audit.frontendRoutes.length}**`,
    `- Registered backend API routes: **${audit.apiBackendRoutes.length}**`,
    `- Registered backend routes including health endpoints: **${audit.backendRoutes.length}**`,
    `- Frontend contracts currently implemented: **${implemented}**`,
    `- Frontend contracts still missing: **${missing}**`,
    `- Frontend contracts currently incompatible: **${incompatible}**`,
    '',
    missing || incompatible
      ? 'Any missing or incompatible route remains unavailable in API mode and must not fall back to mock behavior.'
      : 'Every active API-mode adapter contract has a matching backend route. Contract parity does not replace workflow, authorization, persistence or browser acceptance testing.',
    '',
    '| Frontend route | Method | Authentication | CSRF | Backend status | Priority |',
    '| --- | --- | --- | --- | --- | --- |',
    ...audit.matrix.map(route => `| ${escapeCell(route.path)} | ${route.method} | ${route.authentication} | ${route.csrf} | ${route.status} | ${route.priority} |`),
    '',
    '## Transport findings',
    '',
    '- `HttpClient` supports GET, POST, PUT, PATCH and DELETE with the shared credential, CSRF, timeout and error-handling policy.',
    '- Credentialed CORS permits the minimal frontend method set only for exact configured HTTPS origins; wildcard and unapproved origins remain rejected.',
    '- Missing later-workflow routes must not be replaced with client-side mock fallbacks in staging.',
    '',
  ].join('\n');
}

export async function auditRepositoryContract() {
  const [frontendSource, backendSource] = await Promise.all([
    fs.readFile(frontendFile, 'utf8'),
    fs.readFile(backendFile, 'utf8'),
  ]);
  return createContractAudit(extractFrontendRoutes(frontendSource), extractBackendRoutes(backendSource));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const audit = await auditRepositoryContract();
  const report = renderContractAudit(audit);
  if (process.argv.includes('--write')) {
    const output = path.join(root, 'docs/API_MODE_CONTRACT_AUDIT.md');
    await fs.writeFile(output, report, 'utf8');
    console.log(`Wrote ${path.relative(root, output)} (${audit.frontendRoutes.length} frontend routes; ${audit.apiBackendRoutes.length} backend API routes).`);
  } else {
    console.log(report);
  }
}
