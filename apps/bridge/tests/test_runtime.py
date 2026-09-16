from bridge.runtime import RuntimeFacade


class ReadyClient:
    def health(self):
        return {"ready": True}

    def targets(self):
        return []


def test_runtime_facade_maps_ready_browser_to_supported_capabilities():
    result = RuntimeFacade(ReadyClient()).capability_snapshot()

    assert result.health.status == "ready"
    assert result.capabilities["discover"] == "supported"
