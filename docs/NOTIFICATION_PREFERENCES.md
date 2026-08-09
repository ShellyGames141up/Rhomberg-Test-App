# Notification preferences

Settings presents customer branches for RFQs, quotations, orders, documents, account and general notices. Internal users receive role-specific topics for Sales, Technical, Planning, Laboratory, Expediting, QA, Dispatch, management and administration.

In-app transactional notices remain enabled. Email and push retain the existing simulated mock delivery structure and are labelled `Available after production integration`. Desktop notifications remain a future integration. Critical security and maintenance topics are locked on where required.

The existing notification preference service remains the delivery-channel authority. Role-topic choices are account-scoped user settings; a future backend should map them to event subscriptions before creating outbox deliveries.

