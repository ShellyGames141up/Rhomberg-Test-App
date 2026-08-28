import { canListOrders, canListRfqs, usesRepresentativeInbox } from '../domain/accessControl.js';
import { accountCan, PERMISSIONS } from './contracts.js';

// Both API and public mock adapters use the same read-only refresh boundary.
export function createWorkspaceUpdates(services) {
  return {
    async revision() { return services.updates ? (await services.updates.getRevision()).revision : null; },
    async snapshot() {
      const account = await services.auth.getSession();
      if (!account || account.forcePasswordChange) return { account, enquiries: [], orders: [], notifications: [], auditEvents: [] };
      const [enquiries, orders, notifications, auditEvents] = await Promise.all([
        canListRfqs(account) ? (usesRepresentativeInbox(account) ? services.enquiries.listRepresentativeInbox() : services.enquiries.list()) : [],
        canListOrders(account) ? services.orders.list() : [],
        services.notifications.list(),
        accountCan(account, PERMISSIONS.READ_AUDIT_HISTORY) ? services.audit.list() : [],
      ]);
      return { account, enquiries, orders, notifications, auditEvents };
    },
  };
}

// One request cycle at a time. Failed/deferred refreshes never consume a revision.
// Lifecycle and timer injection keep this testable without a browser or real clock.
export function startWorkspacePolling({ updates, apply, canApply = () => true, capture = () => null,
  available = () => true, onError = () => {}, onSuccess = () => {},
  intervalMs = 900000, schedule = setTimeout, cancel = clearTimeout }) {
  let stopped = false, running = false, timer, revision, failures = 0;
  const interval = Math.max(10000, intervalMs);
  const tick = async () => {
    if (stopped || running) return;
    cancel(timer);
    running = true;
    try {
      if (!available()) return;
      const before = capture();
      const nextRevision = await updates.revision();
      if (stopped) return;
      if (nextRevision === null || nextRevision !== revision) {
        const snapshot = await updates.snapshot();
        if (!stopped && available() && canApply(before)) {
          apply(snapshot);
          revision = nextRevision;
        }
      }
      failures = 0;
      if (!stopped) onSuccess();
    } catch (error) {
      failures = Math.min(failures + 1, 3);
      if (!stopped) onError(error);
    } finally {
      running = false;
      if (!stopped) timer = schedule(tick, Math.min(interval * 2 ** failures, Math.max(interval, 1200000)));
    }
  };
  timer = schedule(tick, interval);
  return { refresh: tick, stop() { stopped = true; cancel(timer); } };
}
