# End-to-End Demonstration Script

Status: fabricated mock demonstration
Last updated: 29 July 2026

This checklist demonstrates the complete RFQ-to-completed-order journey without a production database, real email, real push notification, pricing, or real customer information. Use one browser profile so the mock service retains the scenario between sign-ins.

The automated equivalent is `tests/end-to-end-demo.test.mjs`.

Each row below states which account to use, which role is active, the action to perform, expected status, expected notification, expected audit event, and expected customer visibility.

## Fabricated accounts

| Workspace | Email | Password | Role |
| --- | --- | --- | --- |
| Customer | `cape.demo@client.test` | `Demo123!` | Customer |
| Sales | `sales.workflow@example.invalid` | `Sales123!` | Sales representative C-27 |
| Planning | `planning.workflow@example.invalid` | `Planning123!` | Planning |
| Expediting | `expeditor.workflow@example.invalid` | `Expedite123!` | Expeditor |
| Dispatch | `dispatch.workflow@example.invalid` | `Dispatch123!` | Dispatch |
| Oversight/PDF/archive | `manager.workflow@example.invalid` | `Manager123!` | Manager |

These are public-preview demonstration identities only. They are not production credentials.

## Before presenting

1. Open the GitHub Pages mock preview in a clean test browser profile.
2. Confirm the app identifies itself as a demonstration/mock environment.
3. Do not enter real customer details, pricing, addresses, Purchase Orders, or documents.
4. Use the fabricated values below consistently so the audience can follow the references.
5. Record the permanent RFQ and order references shown by the app.

## Demonstration checklist

| Step | Account / role | Action | Expected status | Expected notification | Expected audit event | Expected customer visibility |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Customer | Sign in with the Cape fabricated customer. | Existing customer dashboard opens. | No workflow notification required. | Authentication audit belongs to the future backend identity service. | Only the fabricated Cape company’s records are visible. |
| 2 | Customer | Add PBB quantity 2 and PBG quantity 4. Complete every required configuration and save the draft. | RFQ remains `draft`. | None. | Draft-save audit is optional; submission audit is mandatory. | Customer sees both configured lines and quantities. |
| 3 | Customer | Submit using application “Fabricated dual pressure monitoring demonstration”, Western Cape, representative C-27 and collection. Confirm there is no customer urgency control. | Customer projection shows `submitted`; internal record is assigned to C-27 with server-managed standard priority. | Customer receives RFQ submitted/assigned confirmation; C-27 receives a new-RFQ notification. | `workflow.submit_rfq`, then `workflow.assign_representative`. | Permanent RFQ reference, safe item details, selected representative, and submission time are visible; urgency is absent. |
| 4 | Sales representative | Sign in and open **New RFQs**. Search by the recorded RFQ reference. | `assigned_to_rep`. | The assignment notification is unread until opened/marked read. | Existing assignment audit remains immutable. | Customer still sees a submitted/assigned-safe description, not internal inbox details. |
| 5 | Sales representative | Select **Start Review**. | `under_rep_review`. | Customer receives “under review”; representative receives confirmation. | `workflow.start_rep_review`. | Customer sees that the RFQ is being reviewed, without internal notes. |
| 6 | Sales representative | Select **Mark as Quoted**. Enter `Q-DEMO-E2E-001`, quote date, expiry date, optional safe customer note, and confirm it was emailed. | `quoted`. | Customer is told the quotation was emailed separately; representative receives confirmation. | `workflow.mark_quoted`. | Quote number/date/safe note may be visible. Internal note and unauthorised document metadata are hidden. No pricing is shown. |
| 7 | Customer | Sign in, open the quote notification, and acknowledge receipt. Explain that this is receipt only—not payment or order acceptance. | `awaiting_customer_acceptance`. | Representative receives customer-acknowledgement notification. | `workflow.acknowledge_quotation`. | Customer sees receipt acknowledged. No order exists yet. |
| 8 | Sales representative | Verify fabricated external acceptance. Enter PO reference `PO-DEMO-E2E-001`, acceptance date, and internal verification note; select **Accept and create order**. | RFQ becomes `converted_to_order`; new order becomes `awaiting_planning`. | Customer and representative receive conversion confirmation; Planning receives a queue notification. | `workflow.accept_order`, `workflow.convert_to_order`, `order.created_from_rfq`. | Customer retains the historical RFQ and sees the new permanent order reference. Acceptance evidence/internal notes are hidden. |
| 9 | Planning | Sign in and open the Planning queue. Search by order or RFQ reference. | `awaiting_planning`. | Planning hand-off notification is present. | Order-creation audit remains immutable. | Customer sees only the approved “sent to Planning” milestone. |
| 10 | Planning | Select **Start Planning**, then add job `JOB-DEMO-E2E-001`, PO `PO-DEMO-E2E-001`, assigned planner, Cape Town location, high priority, planned start and estimated completion. | `planning_in_progress`, then `planned`. | Internal confirmation as configured. | `workflow.start_planning`, `workflow.complete_planning`. | Internal job number, Planning notes, assigned planner, internal documents, and Planning metadata are hidden. |
| 11 | Planning | Select **Submit to Expediting**. | `submitted_to_expediting`. | Expeditor queue and assigned representative are notified. | `workflow.submit_to_expediting`. | Customer sees an approved hand-off description only. |
| 12 | Expeditor | Sign in, open the order, select **Start work**, then add `materials_checked`, `production_started`, `calibration_or_testing`, `quality_check`, and `paperwork_preparation` updates. | `expediting_in_progress`. | Each customer-visible update notifies customer and assigned representative. | `workflow.start_expediting` and one `workflow.add_expediting_update` per update. | Customer sees safe progress messages and estimated completion date; internal notes/delay details are absent. |
| 13 | Customer, then Sales representative | Sign in to each account and open Notifications/Order Tracking. | Still `expediting_in_progress`. | Both accounts show the customer-visible progress events, including quality review. | Notification-created/delivery audit evidence is internal. | Both timelines contain the same safe progress; only authorised internal views contain internal notes. |
| 14 | Expeditor | Confirm required steps and select **Submit to Dispatch**. | `awaiting_dispatch`. | Dispatch, customer, and representative receive the hand-off notice. | `workflow.complete_expediting`. | Customer sees “moving to Dispatch”; hand-off checks and exceptions remain internal. |
| 15 | Dispatch | Sign in, open the order, choose collection, add ready date, two packages, delivery note `DN-DEMO-E2E-001`, then select **Mark Ready for Collection**. | `ready_for_collection`. | Customer and representative receive ready-for-collection notification. | `workflow.mark_ready_for_collection`. | Customer sees collection readiness and the safe customer message, not internal Dispatch notes. |
| 16 | Dispatch | Select **Confirm Collected**. Enter fabricated collector, date, and proof reference `POD-DEMO-E2E-001`. | `collected`. | Customer and representative receive collection confirmation. | `workflow.confirm_collection`. | Safe collector/proof reference may be visible; internal notes and private file metadata are hidden. |
| 17 | Dispatch | Select **Mark Completed** for the collected order. | `completed`. | Final completion notification goes to customer and representative. | `workflow.complete_collection`. | Customer sees the completed milestone and complete safe timeline. |
| 18 | Manager | Sign in, open the completed order, and generate **Internal operational copy**. | Remains `completed`. | No customer workflow notification. | `order_summary_pdf_generated`. | Internal PDF is authorised for internal use only and must never be offered as a customer download. |
| 19 | Manager | Generate **Customer-safe copy**. | Remains `completed`. | No customer workflow notification unless a later approved sharing action occurs. | Second `order_summary_pdf_generated`. | Customer PDF excludes internal notes, audit, protected configuration keys, and pricing. |
| 20 | Manager | Open Archive after the retention threshold. In the automated test, the injected clock advances beyond 90 days; in the browser demo, use the seeded archive-eligible example until real time elapses. | `archive_eligible` retention state; order workflow remains completed until archived. | No customer notification merely for eligibility. | `retention.archive_eligible`. | Customers retain completed-order history according to the approved policy; the internal archive workspace is not visible. |

## Expected final evidence

- One permanent RFQ reference and one permanent order reference.
- Two immutable configured order lines with quantities 2 and 4.
- Final order status `completed`.
- Customer and assigned-representative progress notifications.
- Customer timeline with no internal Planning, Expediting, Dispatch, audit, or override detail.
- One internal PDF and one customer-safe PDF, both valid PDF byte streams.
- Append-only audit coverage for every important workflow action and both PDF generations.
- Archive eligibility after the configured retention threshold.

## Presenter notes

- Quotation preparation and sending remain external to the app. Mock notifications only state that it was sent separately.
- The preview simulates email/push delivery states and does not contact a provider.
- Do not describe customer quotation acknowledgement as payment or order acceptance.
- The browser preview’s data is demonstration storage on that browser. The proposed backend specification is not connected.

## Phase 21 fabricated demonstrations

Use the internal desktop preview for Laboratory and QA. These scenarios are also exercised by `tests/phase21.test.mjs`. All names, references and files must remain fabricated.

### Scenario A — SANAS order

| Step | Role/account | Action | Expected result |
| --- | --- | --- | --- |
| A1 | Planning | Open seeded SANAS order `OR-LAB-2101` and submit its certified route. | Laboratory receives one unit task per quantity; QA does not receive it. |
| A2 | Laboratory (`laboratory.workflow@example.invalid`) | Confirm receipt; start and complete each calibration unit. | Customer, assigned representative and Expeditor receive scoped safe updates; internal notes stay internal. |
| A3 | Laboratory | Release physically to Dispatch while certificates remain pending. | Order movement continues; permanent certificate queue still lists every pending unit. |
| A4 | Dispatch | Confirm receipt from Laboratory. | Custody, source, packages, audit and safe timelines are recorded. |
| A5 | Laboratory | Upload a fabricated PDF with a unique number for every unit. | Each unit becomes certificate-complete; duplicate unit upload is rejected. |
| A6 | Customer | Download only the certificate belonging to the authorised demo company. | Audited download succeeds; another company and a sales representative are denied. |
| A7 | Laboratory manager | Archive the Laboratory task. | Archive succeeds only after physical release and all unit PDFs; legal hold/investigation blocks it. |

### Scenario B — Traceable order

Repeat A1–A7 with seeded Traceable order `OR-LAB-2102`, selecting certificate type `traceable`. Verify the monthly tracker counts certificates per unit—not per order—and that the ordinary QA queue excludes the order.

### Scenario C — non-Lab QA failure and reinspection

| Step | Role/account | Action | Expected result |
| --- | --- | --- | --- |
| C1 | Expeditor | Complete standard production and submit seeded order `OR-QA-2103` to QA. | Status is `awaiting_qa`; Laboratory does not receive it. |
| C2 | QA (`quality.workflow@example.invalid`) | Start inspection and report a fabricated leakage problem for an affected line, returning it to Assembly. | Immutable failed inspection and rework cycle are created; customer, representative and Expeditor receive safe notifications. |
| C3 | Expeditor | Track correction and resubmit to QA. | Status becomes `qa_reinspection_required`; original failure remains. |
| C4 | QA | Start reinspection, confirm checklist/requirements, pass and release. | Second attempt passes; order becomes `awaiting_dispatch`. |
| C5 | Dispatch | Confirm physical receipt, then complete collection or delivery. | Dispatch actions are blocked before receipt; afterwards the normal handover completes. |

### Credential and branch checks

- Customer and internal accounts cannot cross authentication realms.
- Request a demo credential change, use the labelled mock code once, and verify expiry/reuse rejection.
- Durban shows Dawie and Nadia only; Port Elizabeth shows Carmen only.
- A dedicated company representative is reused on later RFQs; only authorised management can reassign it.

## Representative-loaded order demonstration

Use fabricated files only, for example two different small PDFs named `Q-DEMO-4102.pdf` and `PO-DEMO-4102.pdf`.

| Step | Account / role | Action | Expected status | Expected notification | Expected audit event | Expected customer visibility |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Sales Representative | Sign in on Operations desktop or mobile and select **Load Customer Order**. | Form opens; no record exists yet. | None. | None. | Customer cannot access this navigation item. |
| R2 | Sales Representative | Select the assigned fabricated Cape company/contact, Cape Town branch, own representative identity and source Email. Add PBG quantity 3 with valid configuration and choose urgent internal priority. | Draft remains in form. | None. | None until submission. | Internal priority is not customer-visible. |
| R3 | Sales Representative | Enter `Q-DEMO-4102` and `PO-DEMO-4102`, their fabricated dates, attach the two different PDFs, complete all five confirmations and submit. | New order is `awaiting_planning`; no RFQ is created. | Representative confirmation, customer order-available and Planning queue notifications are created. | `order.representative_loaded` and one `document.uploaded` event per source file. | Customer sees reference, product summary, assigned Representative, safe timeline and current quotation/PO metadata. |
| R4 | Sales Representative | Repeat the exact submission or click twice. | Existing order is returned by idempotency; no second order. | No duplicate second notification. | Production records an idempotent replay; mock preserves the original creation audit. | Only one order is visible. |
| R5 | Sales Representative | Change the submission key but reuse the PO/quotation references. Review the duplicate warning and explicitly confirm only for the fabricated test. | A second order is created only after confirmation. | Management receives the duplicate-confirmed notification. | `order.possible_duplicate_confirmed`. | Internal duplicate evidence remains hidden. |
| R6 | Planning | Sign in and search the Planning queue for the first order reference. | `awaiting_planning`. | Planning receipt notification is present. | Original creation event remains immutable. | Customer sees only the approved Planning milestone. |
| R7 | Customer | Sign in as `cape.demo@client.test`, open Order Tracking and select the order. | Still `awaiting_planning`. | Customer order-available notification is visible. | Downloading either source document records `document.downloaded`. | Current quotation and own PO are available; internal notes, urgency, origin and duplicate evidence are absent. |
| R8 | Another fabricated customer | Sign in as `customer.demo@example.invalid` and attempt to access the recorded order/document. | Request is not found/denied. | None. | A production denial audit is required. | No cross-company record or document data is disclosed. |

Mock mode validates document metadata but does not retain the file bytes, so the download action returns an audited simulation message. Production demonstrations must wait for private storage, scanning and IT approval.

## Technical Support RFQ scenario

1. Customer submits a fabricated RFQ; expect `assigned_to_rep` and no urgency field.
2. Representative starts review and submits **Technical Support Required** for a line item; expect one 24-hour extension and safe notifications.
3. Attempt **Mark as Quoted**; expect `TECHNICAL_REVIEW_PENDING`.
4. Technical Manager assigns Technical Support; expect `technical_support_assigned`.
5. Technical Support starts review and requests customer information through Sales.
6. Representative forwards safe wording; Customer replies in the RFQ thread. Internal messages must remain absent from customer payloads.
7. Technical Support submits a recommendation and completes review; expect the block cleared, audit events and customer/Representative notifications.
8. Sales Manager or Company Owner reviews metrics. The Sales Manager override demonstration must require a reason.
