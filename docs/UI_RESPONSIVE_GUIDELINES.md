# Responsive UI Guidelines

Rhomberg Connect uses one shared responsive system across Customer, Sales, Technical, Planning, Laboratory, Quality Assurance, Dispatch, Management, Audit, Archive and Administration workspaces.

## Data displays

- Large desktop: complete tables or aligned operational rows.
- Tablet: compressed columns, reduced spacing and horizontal scrolling only inside the data region when required.
- Mobile: one record per card, labelled values, full-width actions and no page-level horizontal scrolling.

The shared `responsive-data-display` CSS contract also targets the established role-specific queue and table classes. New data views should use semantic table markup when the relationship is tabular, add `data-label` to mobile table cells, keep essential identifiers visible, and move secondary detail into an expandable section.

Actions must remain keyboard accessible, touch targets should be at least 44 px, and status must never be communicated by colour alone. Long references may wrap, but currency, dates and short numeric values should remain intact where space permits.
