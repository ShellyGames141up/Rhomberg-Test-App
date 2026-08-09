# Sound and haptic feedback

The feedback module synthesises short tones lazily through the browser audio context. No audio files are preloaded. Navigation, standard buttons, primary actions, secondary actions, toggles, selections and tutorial steps each use a small approved pool of tone variants. A variant and very small pitch variation are selected per interaction so repeated clicks feel less mechanical without becoming distracting.

Distinct restrained sounds remain available for success, warning, error, notifications, transfer actions, RFQ submission and startup. The default volume is more audible than the original implementation, remains capped, and is fully adjustable or disableable in Settings. Rapid overlapping sounds are limited to avoid noise and performance issues.

Haptics use the browser/native `vibrate` capability only when supported and enabled. Patterns are short and limited to button, success, warning, error and important-workflow feedback. Unsupported devices fail silently.

Sounds and haptics are enhancement-only: they never replace visible state, accessible text, validation or workflow confirmation and cannot block a request.
