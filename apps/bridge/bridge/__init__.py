"""Local Execution Bridge for the beg career platform."""

from .protocol import BridgeCapabilities, BridgeHealth, capability_snapshot

__all__ = ["BridgeCapabilities", "BridgeHealth", "capability_snapshot"]
