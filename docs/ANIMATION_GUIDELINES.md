# Animation guidelines

Animations are restrained, GPU-friendly and never delay a service action.

- Startup: fade/scale entrance, one gauge sweep, subtle glow and loading line; approximately three seconds maximum.
- First customer login: one logo entrance and welcome text sequence.
- Buttons: small press movement only.
- Cards: slight desktop elevation.
- Toasts and success panels: fade with a short upward movement.
- Tutorial: dimmed app stage and a small tooltip entrance.

`Reduce Motion` or the system `prefers-reduced-motion` preference reduces durations to a simple state change, disables the gauge sweep and removes sliding/scaling. Decorative animation can also be disabled separately.

