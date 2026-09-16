from bridge.protocol import BridgeCapabilities, BridgeHealth, capability_snapshot


def test_capability_snapshot_starts_ready_without_browser():
    result = capability_snapshot(browser_ready=False)

    assert isinstance(result, BridgeCapabilities)
    assert result.health.status == 'degraded'
    assert result.health.reason == 'browser_unavailable'
    assert result.capabilities['discover'] == 'manual'
    assert result.capabilities['observe_conversation'] == 'manual'
    assert result.capabilities['submit_application'] == 'unavailable'


def test_capability_snapshot_reports_ready_browser():
    result = capability_snapshot(browser_ready=True)

    assert isinstance(result.health, BridgeHealth)
    assert result.health.status == 'ready'
    assert result.capabilities['discover'] == 'supported'
    assert result.capabilities['submit_application'] == 'supported'
