import { statusToneFor } from '../shared/design/tokens.js';

export function StatusBadge({
  status,
  label,
  children,
  className = '',
  as: Element = 'span',
}) {
  const tone = statusToneFor(status);
  return (
    <Element
      className={`status-badge status-badge--${tone} ${className}`.trim()}
      data-status={status || 'unspecified'}
      data-status-tone={tone}
    >
      {label || children || status}
    </Element>
  );
}
