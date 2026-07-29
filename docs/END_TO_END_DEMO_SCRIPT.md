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
| 3 | Customer | Submit using application “Fabricated dual pressure monitoring demonstration”, Western Cape, representative C-27, standard priority, and collection. | Customer projection shows `submitted`; internal record is assigned to C-27. | Customer receives RFQ submitted/assigned confirmation; C-27 receives a new-RFQ notification. | `workflow.submit_rfq`, then `workflow.assign_representative`. | Permanent RFQ reference, safe item details, selected representative, and submission time are visible. |
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
