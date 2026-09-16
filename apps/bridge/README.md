# beg Local Execution Bridge

This bridge is the local execution boundary between the beg API and the user's browser session. It owns browser health, page observation, connector capability reporting, cooperative cancellation, and approved execution requests. It does not own beg domain state.

The `runtime/` directory contains the authorized reusable BossHunter browser runtime. Preserve the upstream copyright and license notice when distributing or copying this directory.

The first slice exposes only health and capability reporting. Platform collectors and approved actions are added behind the bridge protocol after their contract tests exist.
