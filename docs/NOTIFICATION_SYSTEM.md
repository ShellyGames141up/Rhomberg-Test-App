# Notification system

## Scope

Prompt 9 introduces one central notification domain and service for Rhomberg Connect and Rhomberg Operations. The GitHub Pages preview fully supports in-app notifications and deliberately simulates email and mobile push. It does not contact an email server, Microsoft 365, Firebase, Apple or any other provider.

The source of truth is:

- `src/domain/notifications.js` for event types, messages, categories, delivery states, preferences and retry metadata;
- `services.notifications` for all reads and changes;
- `src/domain/accessControl.js` for company, representative and wider-management scope;
- `src/components/Notifications.jsx` for the shared responsive notification centre.

React components do not access browser storage or change notification records directly.

## Event catalogue

| Event | Created from | Primary recipients | Category |
|---|---|---|---|
| `rfq_submitted` | Customer submits RFQ | Customer | RFQ updates |
| `rfq_assigned` | Workflow assigns representative | Customer, assigned representative | RFQ updates |
| `rfq_under_review` | Representative starts review | Customer, assigned representative | RFQ updates |
| `rfq_quoted` | Representative marks quoted | Customer, assigned representative | Quotation |
| `customer_acknowledgement` | Customer confirms receipt | Customer, assigned representative | Quotation |
| `order_accepted` | Representative verifies external acceptance | Customer, assigned representative | Order progress |
| `order_created` | Accepted RFQ is converted | Customer, assigned representative, Planning | Order progress |
| `order_sent_to_planning` | Order enters Planning | Assigned representative, Planning | Order progress |
| `order_sent_to_expediting` | Planning hands off | Customer, assigned representative, Expeditor | Order progress |
| `customer_progress_update` | Customer-visible Expediting update | Customer, assigned representative | Order progress |
| `order_delayed` | Progress update records a delay | Customer, assigned representative | Delays |
| `order_on_hold` | Authorised hold action | Customer, assigned representative | Delays |
| `order_resumed` | Authorised resume action | Customer, assigned representative | Order progress |
| `order_sent_to_dispatch` | Expediting hands off | Customer, assigned representative, Dispatch | Fulfilment |
| `ready_for_collection` | Dispatch releases collection | Customer, assigned representative | Fulfilment |
| `out_for_delivery` | Dispatch starts delivery | Customer, assigned representative | Fulfilment |
| `delivered` | Dispatch confirms delivery | Customer, assigned representative | Fulfilment |
| `collected` | Dispatch confirms collection | Customer, assigned representative | Fulfilment |
| `completed` | Dispatch closes the order | Customer, assigned representative | Fulfilment |
| `delivery_problem_reported` | Dispatch records a delivery/collection problem | Customer, assigned representative | Delays |
| `order_cancelled` | Manager/admin cancels order | Customer, assigned representative | Order progress |

Existing RFQ cancellation, expiry and authorised workflow-override messages also use the central service.

## Delivery model

One logical event is expanded into recipient-specific production notification rows. Each recipient has independent message visibility, read state and delivery attempts.

Supported channels:

- `in_app`
- `email`
- `push`

Supported delivery statuses:

- `in_app`
- `email_pending`
- `email_sent`
- `email_failed`
- `push_pending`
- `push_sent`
- `push_failed`

Every email or push delivery stores:

- attempt count and maximum attempts;
- last-attempt and next-retry timestamps;
- safe provider-independent error code;
- retryable flag;
- delivered timestamp;
- provider message reference, server-side only.

Provider credentials, access tokens and full provider responses must never be stored in a notification payload or returned to the browser.

## Mock-preview behavior

The browser mock:

1. writes the workflow record and audit event;
2. creates the central notification event;
3. creates an immediate `in_app` delivery per recipient;
4. deterministically selects pending, sent or failed simulation states for email and push;
5. stores only demo records in the browser service;
6. never performs a network delivery call.

Manager and Administrator demo accounts may retry a failed simulated delivery. The retry updates attempt metadata and adds an audit event, but still contacts no provider.

The notification centre provides:

- All and Unread views;
- unread count in the navigation;
- mark one as read;
- mark all as read;
- direct links that open the relevant RFQ/order;
- channel and category preferences;
- delivery-state chips;
- manager/admin retry controls;
- compact audit context.

## Access and isolation

Access is enforced in the service before preference filtering:

- Customers see only customer-visible notifications whose `companyId` matches an authorised company account.
- Sales representatives see only notifications addressed to the authoritative representative ID on their session and assigned record.
- Planning, Expediting and Dispatch see only messages addressed to their queue role and records allowed by queue scope.
- Managers and Administrators may see wider records only through named permissions.
- Buyer receives no workflow notifications while its workflow remains inactive.
- Read state is per user. One recipient cannot mark another recipient's notification as read.
- A disabled preference cannot grant access to a record and re-enabling it cannot reveal an out-of-scope record.

Production must create one row per resolved recipient user. It must not depend on a client-supplied company, representative, recipient, actor or role.

## Preferences

The central preference document contains:

```json
{
  "schemaVersion": 1,
  "channels": {
    "inApp": true,
    "email": true,
    "push": true
  },
  "categories": {
    "rfqUpdates": true,
    "quotationNotifications": true,
    "orderProgress": true,
    "delayNotifications": true,
    "fulfilmentNotifications": true,
    "accountSecurity": true,
    "maintenanceNotices": true,
    "companyAnnouncements": true
  }
}
```

In-app, account/security and maintenance notifications are mandatory. Customer personalisation mirrors category choices so the existing setup wizard remains compatible; the production notification-preference endpoint is the canonical source.

## Production transaction and worker

The API request must never call an email/push provider before the workflow transaction commits.

```text
Workflow API transaction
  -> validate session, role, assignment, company and state
  -> update RFQ/order
  -> append workflow event
  -> append audit event
  -> resolve authorised recipient users
  -> insert notification rows
  -> insert in-app/email/push delivery rows
  -> commit

Background delivery workers
  -> lock pending rows with SKIP LOCKED
  -> apply preference and environment routing policy
  -> call approved provider with idempotency key
  -> store safe sent/failed metadata
  -> schedule bounded retry or dead-letter review
  -> append delivery audit event
```

The production worker needs:

- bounded exponential backoff with jitter;
- maximum attempts and dead-letter handling;
- idempotency per delivery;
- concurrency-safe row locking;
- per-provider and per-tenant rate limiting;
- safe templates with output encoding;
- monitoring for age, failure rate and dead-letter count;
- manual retry limited to the approved permission;
- retention rules for messages and provider metadata.

## Microsoft 365 or SMTP email

IT must select and approve one delivery path.

### Microsoft 365 / Microsoft Graph

Provide:

- an approved sending mailbox;
- a dedicated Entra application or managed workload identity;
- the minimum Microsoft Graph mail permission;
- Exchange Application RBAC or an application-access policy restricting the app to approved mailboxes;
- certificate/secret storage in the company vault;
- tenant ID, client ID and approved authority as server-only configuration;
- non-production mailbox/routing;
- throttling, expiry/rotation and incident-response procedures.

The preferred production authentication is a managed identity or certificate where the hosting platform supports it. No token or application secret may enter GitHub, the static bundle or browser runtime configuration.

### SMTP relay

Provide:

- approved relay hostname/port and TLS policy;
- sender-domain and mailbox restrictions;
- IP or authenticated-relay policy;
- server-only secret-vault reference where authentication is required;
- SPF, DKIM and DMARC decisions;
- bounce/rejection handling and non-production routing.

SMTP delivery must still use the same durable notification-delivery outbox and retry rules.

### Email content

Email templates should contain the reference, safe milestone text and a link back to the authorised app. They must not include protected pricing, internal notes, internal job information, provider errors, credentials or documents unless a later approved document-delivery phase explicitly authorises them.

## Mobile push

IT/mobile developers must provide:

- approved Apple Push Notification service and/or Firebase Cloud Messaging projects for each environment;
- mobile app bundle/application identifiers;
- server credentials in the secret vault;
- a device-registration API;
- encrypted device-token storage linked to user and installation;
- user consent and preference handling;
- token rotation, invalid-token cleanup and device sign-out revocation;
- deep-link routes for authorised RFQ/order screens;
- payload-size, rate and privacy rules;
- staging devices and a delivery-test procedure.

Push payloads should contain only a generic title, safe short message, event ID and opaque deep-link identifier. The mobile app must fetch the authorised record from the API after opening the notification.

## API endpoints

The proposed OpenAPI contract defines:

- `GET /notifications`
- `POST /notifications/{notificationId}/read`
- `POST /notifications/read-all`
- `GET /users/me/notification-preferences`
- `PUT /users/me/notification-preferences`
- `POST /notifications/{notificationId}/deliveries/{deliveryId}/retry`

See `docs/api/openapi.yaml` and `docs/API-CONTRACT.md` for request/response structures.

## Audit events

The current mock records:

- `notification.created`
- `notification.read`
- `notification.read_all`
- `notification.preferences_updated`
- `notification.delivery_retry_requested`

Production must additionally record worker delivery success/failure, preference-policy suppression, dead-letter movement and administrative retry. Audit messages must exclude secrets and unnecessary provider/customer content.

## IT acceptance checklist

- Event and customer wording approved by Sales, Planning, Expediting and Dispatch.
- Recipient rules approved, including group membership and representative reassignment.
- Microsoft 365/SMTP choice and non-production routing approved.
- APNs/FCM choice and mobile-app ownership approved.
- Database migration and RLS policies reviewed.
- Worker scaling, retry and dead-letter limits approved.
- Templates security-reviewed and localised if required.
- Customer A/B and representative assignment isolation tests pass.
- No real delivery occurs from local/GitHub Pages builds.
- Staging delivery tests use approved test recipients only.
- Audit, monitoring, alerting, retention, backup and restore are verified.
