import asyncio

import pytest


@pytest.mark.asyncio
async def test_opcua_adapter_reads_from_opcua_asyncio_test_server(opcua_server):
    """Unit test OPC-UA adapter against opcua-asyncio test server.

    The `opcua_server` fixture is expected to be provided by opcua-asyncio test
    helpers.

    NOTE: If your test environment doesn't ship that fixture, add a small local
    fixture that starts the test server.
    """

    from edge.adapters.opcua_adapter import OpcUaAdapter

    idx = await opcua_server.register_namespace("reliabilityos.test")

    # Create variable
    var = await opcua_server.nodes.objects.add_variable(idx, "WallThickness", 7.12)
    await var.set_writable()

    node_id = f"ns={idx};s=WallThickness"

    adapter = OpcUaAdapter(
        endpoint=opcua_server.endpoint,  # e.g. "opc.tcp://127.0.0.1:4840"
        sensors=[
            {
                "sensor_id": "seg036_wall_thickness",
                "segment_id": "seg036_wall_thickness",
                "node_id": node_id,
                "sensor_type": "ultrasonic_thickness",
                "unit": "mm",
            }
        ],
    )

    await adapter.connect()
    readings = await adapter.read()
    await adapter.disconnect()

    readings_list = list(readings)
    assert len(readings_list) == 1
    assert readings_list[0].sensor_id == "seg036_wall_thickness"
    assert abs(readings_list[0].value - 7.12) < 1e-6
    assert readings_list[0].source == "opcua"

