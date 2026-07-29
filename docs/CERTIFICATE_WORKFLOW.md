# Certificate workflow

Certificate tracking is intentionally independent from physical order movement.

```text
Requirement created per unit
       |
       v
required -> pending -> in preparation -> ready for upload
                                             |
                                             v
                                      PDF uploaded
                                             |
                         +-------------------+------------------+
                         |                                      |
                    available                              correction required
                         |                                      |
                         v                                      v
                       archived                         new immutable version
```

## Upload rules

A certificate upload requires a non-empty PDF, allowed file size, certificate number, certificate date, type, unit, order and order-item relationship. The service rejects duplicate certificate numbers, duplicate unit certificates, missing relationships, invalid dates and non-PDF files.

Optional fields are expiry date, result summary, serial number and internal note. Internal notes are never customer-visible. Corrections become additional immutable versions rather than replacement of history.

## Access

Permanent download is limited to:

- a customer authorised for the owning company and order;
- Laboratory user or manager;
- Manager;
- Administrator.

Every download is audited. A production API must return a short-lived signed URL only after server-side scope and permission checks. Object storage must be private, malware-scanned, encrypted and prevented from serving files by guessable public paths.

## Archive

A Laboratory task cannot archive until all required unit certificates are uploaded and verified, physical work has left/closed, and no legal hold, investigation or correction remains. Completing the overall order does not waive these controls.
