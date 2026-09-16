from pathlib import Path
from typing import Any, Protocol


class BrowserRuntime(Protocol):
    def health(self) -> dict[str, Any] | None: ...

    def targets(self) -> list[dict[str, Any]]: ...


class RuntimeFacade:
    """Small bridge-owned facade around the authorized BossHunter CDP client."""

    def __init__(self, client: BrowserRuntime | None = None) -> None:
        self._client = client

    def browser_ready(self) -> bool:
        if self._client is None:
            return False
        try:
            health = self._client.health()
        except Exception:
            return False
        return bool(health and health.get("ready") is True)

    def capability_snapshot(self):
        from .protocol import capability_snapshot

        return capability_snapshot(browser_ready=self.browser_ready())

    def runtime_root(self) -> Path:
        return Path(__file__).resolve().parent / "runtime"
