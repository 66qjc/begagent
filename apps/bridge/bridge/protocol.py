from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

Capability = Literal["supported", "manual", "unavailable"]
HealthStatus = Literal["ready", "degraded"]


@dataclass(frozen=True)
class BridgeHealth:
    status: HealthStatus
    reason: str | None
    observed_at: str


@dataclass(frozen=True)
class BridgeCapabilities:
    health: BridgeHealth
    capabilities: dict[str, Capability]


def capability_snapshot(*, browser_ready: bool) -> BridgeCapabilities:
    observed_at = datetime.now(UTC).isoformat()
    if browser_ready:
        health = BridgeHealth("ready", None, observed_at)
        capability: Capability = "supported"
        return BridgeCapabilities(
            health=health,
            capabilities={
                "discover": capability,
                "inspect": capability,
                "observe_conversation": capability,
                "submit_application": capability,
                "send_message": capability,
                "upload_resume": capability,
            },
        )

    return BridgeCapabilities(
        health=BridgeHealth("degraded", "browser_unavailable", observed_at),
        capabilities={
            "discover": "manual",
            "inspect": "manual",
            "observe_conversation": "manual",
            "submit_application": "unavailable",
            "send_message": "unavailable",
            "upload_resume": "manual",
        },
    )
