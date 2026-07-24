import { useMemo, useState } from 'react';
import { statusById } from '../domain/tracking.js';

const formatDate = value => new Date(value).toLocaleString('en-ZA', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function Notifications({ notifications, onMarkRead, serviceMode }) {
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const ordered = useMemo(
    () => [...notifications].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)),
    [notifications],
  );
  const unread = ordered.filter(notification => !notification.readAt).length;

  const markRead = async notification => {
    if (notification.readAt || savingId) return;
    setError('');
    setSavingId(notification.id);
    try {
      await onMarkRead(notification.id);
    } catch (markError) {
      setError(markError?.message || 'This notification could not be marked as read. Please try again.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <section className="app-screen notifications-screen" aria-labelledby="notifications-title">
      <header className="notifications-hero">
        <span className="eyebrow">Workflow updates</span>
        <h1 id="notifications-title">Your notification<br /><em>inbox.</em></h1>
        <p>Important RFQ and order updates appear here for the customer or internal role responsible for the next step.</p>
        <div className="notification-counts">
          <span><strong>{unread}</strong><small>Unread</small></span>
          <span><strong>{ordered.length}</strong><small>Total</small></span>
        </div>
      </header>

      {error && <p className="notification-error" role="alert">{error}</p>}

      <div className="notification-list">
        {ordered.map(notification => {
          const status = statusById(notification.status, notification.entityType);
          const isUnread = !notification.readAt;
          return (
            <article className={`notification-card ${isUnread ? 'is-unread' : ''}`} key={notification.id}>
              <span className="notification-symbol" aria-hidden="true">{notification.entityType === 'order' ? 'OR' : 'RQ'}</span>
              <div>
                <span className="notification-meta">{notification.reference || (notification.entityType === 'order' ? 'Order update' : 'RFQ update')} · {formatDate(notification.createdAt)}</span>
                <h2>{status.label}</h2>
                <p>{notification.message || status.customerDescription}</p>
              </div>
              {isUnread ? (
                <button type="button" onClick={() => markRead(notification)} disabled={savingId === notification.id}>
                  {savingId === notification.id ? 'Saving…' : 'Mark read'}
                </button>
              ) : <span className="notification-read">Read</span>}
            </article>
          );
        })}
        {!ordered.length && (
          <div className="notifications-empty">
            <span>✓</span>
            <h2>You are up to date</h2>
            <p>New workflow messages will appear here when an RFQ or order reaches a stage relevant to your account.</p>
          </div>
        )}
      </div>

      <p className="tracking-storage-note notification-storage-note">
        <span>i</span>
        <span><strong>{serviceMode === 'mock' ? 'Test inbox' : 'Secure notification service'}</strong> {serviceMode === 'mock' ? 'Notifications are isolated by test account and saved in this browser.' : 'Notifications are loaded only for your authorised company or internal role.'}</span>
      </p>
    </section>
  );
}
