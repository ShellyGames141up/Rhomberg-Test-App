# Sound and haptic feedback

The feedback module synthesises short tones lazily through the browser audio context. No large audio file is preloaded. Categories include navigation, buttons, success, warning, error, notifications, upload/download, RFQ submission and startup.

Haptics use the browser/native `vibrate` capability only when supported and enabled. Patterns are short and limited to button, success, warning, error and important-workflow feedback. Unsupported devices fail silently.

Users control master enablement, volume, individual categories, haptic enablement and light/medium strength from Settings. Test controls run only after a direct user action. Dense internal desktop workspaces default to restrained feedback, and sounds cannot block workflow requests.

