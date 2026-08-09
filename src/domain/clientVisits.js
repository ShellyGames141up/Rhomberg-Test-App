import { ServiceError } from '../services/contracts.js';

export const VISIT_STATUSES = Object.freeze(['scheduled', 'in_progress', 'completed', 'missed_visit', 'cancelled']);
export const VERIFICATION_STATUSES = Object.freeze(['unverified', 'partially_verified', 'verified', 'exception_review']);
export const DEFAULT_VISIT_POLICY = Object.freeze({
  defaultVisitCycleDays: 30,
  advanceReminderDays: 7,
  qrLifetimeMinutes: 10,
  locationEventRetentionDays: 90,
  routineLocationAnalyticsEnabled: false,
});

export const FABRICATED_OFFICE_LOCATIONS = Object.freeze([
  Object.freeze({ id: 'office-ct-demo', branchId: 'cape-town', branch: 'Cape Town', address: 'Fabricated Cape Town office', latitude: -33.9258, longitude: 18.4232, radiusMetres: 250, timeZone: 'Africa/Johannesburg', workingHours: { days: [1, 2, 3, 4, 5], start: '08:00', end: '17:00' }, active: true, fabricated: true }),
  Object.freeze({ id: 'office-jhb-demo', branchId: 'johannesburg', branch: 'Johannesburg', address: 'Fabricated Johannesburg office', latitude: -26.2041, longitude: 28.0473, radiusMetres: 300, timeZone: 'Africa/Johannesburg', workingHours: { days: [1, 2, 3, 4, 5], start: '08:00', end: '17:00' }, active: true, fabricated: true }),
  Object.freeze({ id: 'office-dbn-demo', branchId: 'durban', branch: 'Durban', address: 'Fabricated Durban office', latitude: -29.8587, longitude: 31.0218, radiusMetres: 250, timeZone: 'Africa/Johannesburg', workingHours: { days: [1, 2, 3, 4, 5], start: '08:00', end: '17:00' }, active: true, fabricated: true }),
  Object.freeze({ id: 'office-pe-demo', branchId: 'port-elizabeth', branch: 'Port Elizabeth', address: 'Fabricated Port Elizabeth office', latitude: -33.9608, longitude: 25.6022, radiusMetres: 250, timeZone: 'Africa/Johannesburg', workingHours: { days: [1, 2, 3, 4, 5], start: '08:00', end: '17:00' }, active: true, fabricated: true }),
]);

const daysAgo = days => new Date(Date.now() - days * 86400000).toISOString();
const daysAhead = days => new Date(Date.now() + days * 86400000).toISOString();

export const FABRICATED_REP_CLIENTS = Object.freeze([
  ['client-demo-1', 'Fabricated Mining Services', 'Naledi Contact', 'cape-town', 'C-27', 8, 2],
  ['client-demo-2', 'Fabricated Process Controls', 'Ayesha Contact', 'cape-town', 'C-27', 19, 5],
  ['client-demo-3', 'Fabricated Marine Engineering', 'Mpho Contact', 'cape-town', 'C-27', 27, 3],
  ['client-demo-4', 'Fabricated Food Systems', 'Jordan Contact', 'cape-town', 'C-27', 35, -2],
  ['client-demo-5', 'Fabricated Energy Projects', 'Lesedi Contact', 'cape-town', 'C-27', 4, 10],
  ['client-demo-6', 'Fabricated Gauteng Plant', 'Sam Contact', 'johannesburg', 'J-14', 6, 4],
  ['client-demo-7', 'Fabricated Automation Works', 'Lerato Contact', 'johannesburg', 'J-14', 12, 8],
  ['client-demo-8', 'Fabricated Metering Group', 'Alex Contact', 'johannesburg', 'J-14', 18, 6],
  ['client-demo-9', 'Fabricated Pumps Africa', 'Kagiso Contact', 'johannesburg', 'J-14', 26, 2],
  ['client-demo-10', 'Fabricated Steel Services', 'Robin Contact', 'johannesburg', 'J-14', 38, -4],
  ['client-demo-11', 'Fabricated Water Utility', 'Tumi Contact', 'johannesburg', 'J-14', 3, 12],
  ['client-demo-12', 'Fabricated Chemical Plant', 'Jamie Contact', 'johannesburg', 'J-14', 31, 1],
].map(([id, company, primaryContact, branchId, representativeId, lastVisitDays, nextVisitDays], index) => Object.freeze({
  id, company, primaryContact, branchId, representativeId, address: `Fabricated customer address ${index + 1}`, latitude: -33.92 + index * 0.002, longitude: 18.42 + index * 0.002,
  verificationRadiusMetres: 180 + (index % 3) * 20, lastVerifiedVisitAt: daysAgo(lastVisitDays), nextPlannedVisitAt: nextVisitDays > 0 ? daysAhead(nextVisitDays) : '',
  rfqsThisMonth: index % 4, quotationsThisMonth: index % 3, ordersThisMonth: index % 2, openRfqs: index % 2, openOrders: (index + 1) % 2,
  lastInteraction: daysAgo(Math.min(lastVisitDays, 6)), notes: 'Fabricated client relationship note.', fabricated: true,
})));

export const distanceMetres = (from, to) => {
  const rad = value => Number(value) * Math.PI / 180;
  const lat1 = rad(from.latitude); const lat2 = rad(to.latitude);
  const deltaLat = lat2 - lat1; const deltaLon = rad(to.longitude) - rad(from.longitude);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const clientVisitHealth = (client, policy = DEFAULT_VISIT_POLICY, asOf = Date.now()) => {
  const days = Math.floor((asOf - new Date(client.lastVerifiedVisitAt).getTime()) / 86400000);
  const remaining = policy.defaultVisitCycleDays - days;
  return { daysSinceLastVerifiedVisit: days, daysRemaining: remaining, status: remaining < 0 ? 'red' : remaining <= policy.advanceReminderDays ? 'amber' : 'green' };
};

export const isWithinWorkingHours = (dateValue, policy) => {
  const date = new Date(dateValue);
  if (!policy?.days?.includes(date.getDay())) return false;
  const minutes = date.getHours() * 60 + date.getMinutes();
  const parse = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  return minutes >= parse(policy.start) && minutes <= parse(policy.end);
};

export const verificationStatus = signals => {
  const score = ['appointmentExists', 'repGeofenceMatch', 'customerConfirmation', 'qrVerified', 'visitStarted', 'visitEnded', 'validDuration'].reduce((sum, key) => sum + (signals?.[key] ? 1 : 0), 0);
  const strongCustomerSignal = signals?.customerConfirmation || signals?.qrVerified;
  if (signals?.verificationFailed) return { score, status: 'exception_review' };
  if (score >= 5 && signals?.repGeofenceMatch && strongCustomerSignal && signals?.visitStarted && signals?.visitEnded) return { score, status: 'verified' };
  if (score > 0) return { score, status: 'partially_verified' };
  return { score, status: 'unverified' };
};

export const validateAppointment = input => {
  const scheduledAt = new Date(input.scheduledAt);
  if (!Number.isFinite(scheduledAt.getTime())) throw new ServiceError('Choose a valid visit date and approximate start time.', { code: 'VISIT_DATE_INVALID', status: 422 });
  if (scheduledAt.getTime() < Date.now() - 60000) throw new ServiceError('Schedule the visit for a future date and time.', { code: 'VISIT_DATE_PAST', status: 422 });
  if (!String(input.purpose || '').trim() || !String(input.contact || '').trim() || !String(input.address || '').trim()) throw new ServiceError('Visit purpose, customer contact and address are required.', { code: 'VISIT_REQUIRED_FIELDS', status: 422 });
  const durationMinutes = Number(input.expectedDurationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) throw new ServiceError('Expected visit duration must be between 15 minutes and 8 hours.', { code: 'VISIT_DURATION_INVALID', status: 422 });
  return { ...input, scheduledAt: scheduledAt.toISOString(), expectedDurationMinutes: durationMinutes };
};

export const visitComplianceMetrics = (clients, appointments, policy = DEFAULT_VISIT_POLICY) => {
  const now = Date.now();
  const visited = clients.filter(client => clientVisitHealth(client, policy, now).daysSinceLastVerifiedVisit <= policy.defaultVisitCycleDays).length;
  const scheduled = appointments.filter(item => item.status === 'scheduled').length;
  const missed = appointments.filter(item => item.status === 'missed_visit').length;
  return { assignedCustomers: clients.length, customersVisited: visited, customersNotVisited: clients.length - visited, scheduledVisits: scheduled, completedVisits: appointments.filter(item => item.status === 'completed').length, missedVisits: missed, dueWithin7Days: clients.filter(client => clientVisitHealth(client, policy, now).status === 'amber').length, overdueMoreThanOneMonth: clients.filter(client => clientVisitHealth(client, policy, now).daysSinceLastVerifiedVisit > policy.defaultVisitCycleDays * 2).length, compliancePercentage: clients.length ? Math.round(visited / clients.length * 100) : 0 };
};
