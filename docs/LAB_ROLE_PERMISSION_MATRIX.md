# Laboratory role and permission matrix

| Capability | Technician | Temperature technician | Manager | Technical signatory | Lab administrator |
|---|---:|---:|---:|---:|---:|
| View assigned/branch queue | Yes | Yes | Yes | Yes | Yes |
| Receipt, inspection, booking | Yes | Yes | Yes | View | Configure |
| Enter raw readings | Pressure/assigned | Temperature/assigned | No | No | No |
| Calculate and complete calibration | Assigned | Assigned | No | No | No |
| Review raw/calculations | No | No | Yes | Yes | Configuration only |
| Generate drafts | No | No | Yes | Yes | No |
| Approve signature stage | No | No | Yes | Yes | No |
| Upload/release signed certificate | No | No | Yes | Yes | No |
| Manage templates/standards | No | No | Limited standards | No | Yes |
| Archive eligible lab job | No | No | Yes | Yes | Yes |

Company, branch, assignment and explicit wider-permission scope apply in addition to the role. Management review never grants permission to overwrite technician raw data. Audit history and signed versions are immutable.
