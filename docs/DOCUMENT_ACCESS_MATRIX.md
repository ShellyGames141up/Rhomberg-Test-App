# Document access matrix

Access is enforced in the service/domain layer in addition to UI visibility.

| Category | Customer | Sales rep | Planning | Expeditor | Dispatch | Manager/Admin | Supersede |
|---|---|---|---|---|---|---|---|
| Customer supporting | Own company, when approved | Assigned | Relevant | Relevant | No | Yes | New version |
| Representative quotation | Own company, sent versions | Assigned | Relevant | No pricing by default | No | Yes | Rep creates next version |
| Customer / corrected PO | Own uploads | Assigned | Relevant | No by default | No | Yes | Customer correction version |
| Planning | No | Relevant | Yes | Relevant handoff | No | Yes | Authorised internal |
| Expediting | No | Relevant | Relevant | Yes | Relevant handoff | Yes | Authorised internal |
| Dispatch | No | Relevant | No | Relevant handoff | Yes | Yes | Authorised internal |
| Delivery note | Own company | Assigned | Relevant | Relevant | Yes | Yes | Authorised internal |
| Courier note | Own company | Assigned | No | Relevant | Yes | Yes | Authorised internal |
| Proof of delivery | No unless explicitly approved | Assigned | No | Relevant | Yes | Yes | Authorised internal |
| Internal operational/other | No | Relevant | Relevant | Relevant | Relevant stage only | Yes | Authorised internal |

Every download requires record access plus category permission and produces an audit event. A guessed/direct document ID returns a not-found response on denial.
