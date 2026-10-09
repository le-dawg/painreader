---
name: painreader
description: Use when the user explicitly wants to launch or close a temporary local document-upload web app and bridge that feeds uploaded image file paths into a Codex thread.
---

# Painreader

Launches a temporary local web app plus local bridge for document uploads, then routes successful uploads back into a target Codex thread via `codex queue`.

## Modes

### `/painreader`

Use the current thread id when it is available in session or goal metadata. Accept either a raw UUID or a `codex://threads/<uuid>` URI.

Run:

```bash
node scripts/painreader-launch.mjs --thread "<thread-uri-or-uuid>"
```

Report the public URL that comes back. Tell the user that uploads from that page will queue the uploaded image file path and event metadata into the target thread.

### `/painreader close`

Run:

```bash
node scripts/painreader-close.mjs --thread "<thread-uri-or-uuid>"
```

Then report whether the bridge, tunnel, and temp runtime were cleaned up.

## Notes

- This skill is explicit-use only. Do not invoke it implicitly.
- `codex queue` does not support image attachments.
- The bridge therefore queues the **image file path** plus event metadata, not the image itself.
