import { useEffect, useMemo, useState } from 'react';
import {
  createDefaultNotificationPreferences,
  deliveryLabel,
  NOTIFICATION_PREFERENCE_CATEGORIES,
  normaliseNotificationPreferences,
} from '../domain/notifications.js';
import { statusById } from '../domain/tracking.js';

const formatDate = value => new Date(value).toLocaleString('en-ZA', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const channelLabel = channel => ({
  in_app: 'In app',
  email: 'Email',
  push: 'Push',
}[channel] || 'Delivery');

const deliveryTone = status => {
  if (status?.endsWith('_failed')) return 'is-failed';
  if (status?.endsWith('_sent') || status === 'in_app') return 'is-sent';
  return 'is-pending';
};

export function Notifications({
  notifications,
  preferences,
  onMarkRead,
  onMarkAllRead,
  onSavePreferences,
  onOpenNotification,
  onRetryDelivery,
  canRetryDelivery = false,
  serviceMode,
}) {
  const [savingId, setSavingId] = useState('');
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [preferenceDraft, setPreferenceDraft] = useState(
    normaliseNotificationPreferences(preferences || createDefaultNotificationPreferences()),
  );

  useEffect(() => {
    setPreferenceDraft(normaliseNotificationPreferences(preferences || createDefaultNotificationPreferences()));
  }, [preferences]);

  const ordered = useMemo(
    () => [...notifications].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)),
    [notifications],
  );
  const unread = ordered.filter(notification => !notification.readAt).length;
  const visible = filter === 'unread' ? ordered.filter(notification => !notification.readAt) : ordered;

  const run = async (key, action, fallback) => {
    if (savingId || markingAll || savingPreferences) return;
    setError('');
    setSavingId(key);
    try {
      await action();
    } catch (actionError) {
      setError(actionError?.message || fallback);
    } finally {
      setSavingId('');
    }
  };

  const markRead = notification => {
    if (notification.readAt) return;
    return run(
      notification.id,
      () => onMarkRead(notification.id),
      'This notification could not be marked as read. Please try again.',
    );
  };

  const markAllRead = async () => {
    if (!unread || markingAll) return;
    setError('');
    setMarkingAll(true);
    try {
      await onMarkAllRead();
    } catch (actionError) {
      setError(actionError?.message || 'The inbox could not be marked as read. Please try again.');
    } finally {
      setMarkingAll(false);
    }
  };

  const savePreferences = async () => {
    setError('');
    setSavingPreferences(true);
    try {
      await onSavePreferences(preferenceDraft);
      setShowPreferences(false);
    } catch (actionError) {
      setError(actionError?.message || 'The notification preferences could not be saved. Please review them and try again.');
    } finally {
      setSavingPreferences(false);
    }
  };

  const openRecord = notification => run(
    `open-${notification.id}`,
    async () => {
      if (!notification.readAt) await onMarkRead(notification.id);
      await onOpenNotification(notification);
    },
    'The linked RFQ or order could not be opened.',
  );

  const retryDelivery = (notification, delivery) => run(
    delivery.id,
    () => onRetryDelivery(notification.id, delivery.id),
    'The simulated delivery could not be retried.',
  );

  const updateChannel = (channel, enabled) => {
    setPreferenceDraft(current => ({
      ...current,
      channels: { ...current.channels, [channel]: enabled },
    }));
  };

  const updateCategory = (category, enabled) => {
    setPreferenceDraft(current => ({
      ...current,
      categories: { ...current.categories, [category]: enabled },
    }));
  };

  return (
    <section className="app-screen notifications-screen" aria-labelledby="notifications-title">
      <header className="notifications-hero">
        <span className="eyebrow">Workflow updates</span>
        <h1 id="notifications-title">Your notification<br /><em>centre.</em></h1>
        <p>RFQ and order milestones appear here only for your authorised company, assignment or internal queue.</p>
        <div className="notification-counts">
          <span><strong>{unread}</strong><small>Unread</small></span>
          <span><strong>{ordered.length}</strong><small>Total</small></span>
        </div>
      </header>

      <div className="notification-toolbar">
        <div className="notification-filter" aria-label="Notification filter">
          <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>All</button>
          <button type="button" className={filter === 'unread' ? 'is-active' : ''} onClick={() => setFilter('unread')}>Unread <span>{unread}</span></button>
        </div>
        <div className="notification-toolbar-actions">
          <button type="button" onClick={markAllRead} disabled={!unread || markingAll}>{markingAll ? 'Saving...' : 'Mark all read'}</button>
          <button type="button" className={showPreferences ? 'is-active' : ''} aria-expanded={showPreferences} onClick={() => setShowPreferences(current => !current)}>Preferences</button>
        </div>
      </div>

      {showPreferences && (
        <section className="notification-settings" aria-labelledby="notification-settings-title">
          <header>
            <div><span className="eyebrow">Delivery choices</span><h2 id="notification-settings-title">Notification preferences</h2></div>
            <span className="notification-simulation-badge">{serviceMode === 'mock' ? 'Simulation only' : 'Secure service'}</span>
          </header>
          <p>In-app alerts remain enabled. In this test preview, email and push choices only change simulated delivery records; no message leaves the browser.</p>
          <div className="notification-channel-grid">
            <label><span><strong>In-app</strong><small>Required workflow inbox</small></span><input type="checkbox" checked readOnly disabled /></label>
            <label><span><strong>Email</strong><small>{serviceMode === 'mock' ? 'Simulated status only' : 'Approved provider required'}</small></span><input type="checkbox" checked={preferenceDraft.channels.email} onChange={event => updateChannel('email', event.target.checked)} /></label>
            <label><span><strong>Mobile push</strong><small>{serviceMode === 'mock' ? 'Simulated status only' : 'Registered device required'}</small></span><input type="checkbox" checked={preferenceDraft.channels.push} onChange={event => updateChannel('push', event.target.checked)} /></label>
          </div>
          <h3>Update categories</h3>
          <div className="notification-category-grid">
            {NOTIFICATION_PREFERENCE_CATEGORIES.map(category => (
              <label key={category.id}>
                <span><strong>{category.label}</strong><small>{category.critical ? 'Required' : 'Optional'}</small></span>
                <input
                  type="checkbox"
                  checked={Boolean(preferenceDraft.categories[category.id])}
                  disabled={category.critical}
                  onChange={event => updateCategory(category.id, event.target.checked)}
                />
              </label>
            ))}
          </div>
          <div className="notification-settings-actions">
            <button type="button" onClick={() => setShowPreferences(false)}>Cancel</button>
            <button type="button" className="primary-button" onClick={savePreferences} disabled={savingPreferences}>{savingPreferences ? 'Saving...' : 'Save preferences'}</button>
          </div>
        </section>
      )}

      {error && <p className="notification-error" role="alert">{error}</p>}

      <div className="notification-list">
        {visible.map(notification => {
          const status = statusById(notification.status, notification.entityType);
          const isUnread = !notification.readAt;
          return (
            <article className={`notification-card ${isUnread ? 'is-unread' : ''} priority-${notification.priority || 'normal'}`} key={notification.id}>
              <span className="notification-symbol" aria-hidden="true">{notification.entityType === 'order' ? 'OR' : 'RQ'}</span>
              <div className="notification-card-copy">
                <span className="notification-meta">{notification.reference || (notification.entityType === 'order' ? 'Order update' : 'RFQ update')} · {formatDate(notification.createdAt)}</span>
                <h2>{notification.title || status.label}</h2>
                <p>{notification.message || status.customerDescription}</p>
                <div className="notification-deliveries" aria-label="Delivery status">
                  {(notification.deliveries || []).map(delivery => (
                    <span className={deliveryTone(delivery.status)} key={delivery.id} title={deliveryLabel(delivery)}>
                      <b>{channelLabel(delivery.channel)}</b>
                      <small>{delivery.status.replace(`${delivery.channel}_`, '').replaceAll('_', ' ')}</small>
                      {canRetryDelivery && delivery.retryable && (
                        <button type="button" onClick={() => retryDelivery(notification, delivery)} disabled={savingId === delivery.id}>
                          {savingId === delivery.id ? 'Retrying...' : 'Retry'}
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <small className="notification-audit-line">Audit · {notification.eventType?.replaceAll('_', ' ') || 'workflow update'} · {notification.audit?.sourceAction?.replaceAll('_', ' ') || 'service event'}</small>
              </div>
              <div className="notification-card-actions">
                <button type="button" className="notification-open-record" onClick={() => openRecord(notification)} disabled={savingId === `open-${notification.id}`}>
                  {savingId === `open-${notification.id}` ? 'Opening...' : `Open ${notification.entityType === 'order' ? 'order' : 'RFQ'}`}
                </button>
                {isUnread ? (
                  <button type="button" onClick={() => markRead(notification)} disabled={savingId === notification.id}>
                    {savingId === notification.id ? 'Saving...' : 'Mark read'}
                  </button>
                ) : <span className="notification-read">Read</span>}
              </div>
            </article>
          );
        })}
        {!visible.length && (
          <div className="notifications-empty">
            <span>✓</span>
            <h2>{filter === 'unread' ? 'No unread notifications' : 'You are up to date'}</h2>
            <p>{filter === 'unread' ? 'All current workflow updates have been read.' : 'New workflow messages will appear here when an RFQ or order reaches a stage relevant to your account.'}</p>
          </div>
        )}
      </div>

      <p className="tracking-storage-note notification-storage-note">
        <span>i</span>
        <span><strong>{serviceMode === 'mock' ? 'Safe test notification service' : 'Secure notification service'}</strong> {serviceMode === 'mock' ? 'In-app messages, read state, preferences and simulated delivery attempts are isolated by test account and saved in this browser.' : 'Notifications are loaded only for your authorised company, assignment or internal role.'}</span>
      </p>
    </section>
  );
}
