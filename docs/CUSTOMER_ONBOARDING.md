# Customer onboarding

After the application splash, a customer with no completed welcome record receives a one-time personalised welcome. Completion is written through `userSettings.completeWelcome()` and audited. It is not shown on every login.

The welcome opens a 12-step interactive tutorial. The customer must perform the journey: start the guide, open Catalogue, choose Pressure, select the PBG unit, open and complete the configurator, add the unit, enter application and fulfilment details, review, submit the fake RFQ and open its tracking timeline. Highlighted actions—not passive Next buttons—advance the flow.

The staged RFQ is always labelled `Tutorial Example` and uses reference `RQ-TUTORIAL-0001`. It exists only inside the tutorial component. It never calls the operational RFQ service and is never written to drafts, RFQs, notifications, representative queues, analytics, audit history or reports.

Progress is persisted through `userSettings.saveTutorialProgress()`. Customers can skip, resume or replay the full, catalogue, RFQ or tracking tutorial from Settings → Help & Tutorials.

The RFQ details step also explains that the company representative is remembered after the first genuine RFQ. The tutorial displays fabricated representative data and does not alter the real company assignment.
