"""
MQTT Bridge

Subscribes to sensor topics published by field instruments and passes
each reading to the gateway callback.  Reconnects automatically on
connection loss with exponential back-off.

Topic structure:
  reliabilityos/{gateway_id}/sensors/{sensor_id}/data
  reliabilityos/{gateway_id}/sensors/{sensor_id}/status

Outbound (cloud bridge):
  reliabilityos/cloud/sensors/batch   – bulk batch upload
"""
from __future__ import annotations

import json
import threading
import time
from typing import Callable

import paho.mqtt.client as mqtt
import structlog

log = structlog.get_logger()


class MQTTBridge:
    def __init__(
        self,
        host: str,
        port: int,
        gateway_id: str,
        on_reading: Callable[[dict], None],
    ):
        self.host = host
        self.port = port
        self.gateway_id = gateway_id
        self.on_reading = on_reading
        self._stop_event = threading.Event()

        self._client = mqtt.Client(
            client_id=f"reliabilityos-edge-{gateway_id}",
            protocol=mqtt.MQTTv5,
        )
        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message
        self._client.on_disconnect = self._on_disconnect

    def start_loop(self) -> None:
        backoff = 1.0
        while not self._stop_event.is_set():
            try:
                self._client.connect(self.host, self.port, keepalive=60)
                self._client.loop_forever()
                backoff = 1.0  # reset on clean disconnect
            except (ConnectionRefusedError, OSError) as exc:
                log.warning("MQTT_CONNECT_FAIL", error=str(exc), retry_in=backoff)
                time.sleep(min(backoff, 60))
                backoff = min(backoff * 2, 60)

    def stop(self) -> None:
        self._stop_event.set()
        self._client.disconnect()

    def publish_batch(self, readings: list[dict]) -> None:
        payload = json.dumps(readings)
        self._client.publish(
            f"reliabilityos/cloud/sensors/batch",
            payload,
            qos=1,
        )

    # ─── Callbacks ────────────────────────────────────────────────────────────
    def _on_connect(self, client, userdata, flags, rc, properties=None) -> None:
        if rc == 0:
            log.info("MQTT_CONNECTED", host=self.host, port=self.port, gw=self.gateway_id)
            # Subscribe to all sensor topics for this gateway
            topic = f"reliabilityos/{self.gateway_id}/sensors/+/data"
            client.subscribe(topic, qos=1)
            log.info("MQTT_SUBSCRIBED", topic=topic)
        else:
            log.error("MQTT_CONNECT_ERROR", rc=rc)

    def _on_message(self, client, userdata, msg: mqtt.MQTTMessage) -> None:
        try:
            reading = json.loads(msg.payload.decode("utf-8"))
            reading["_topic"] = msg.topic
            self.on_reading(reading)
        except json.JSONDecodeError as exc:
            log.warning("MQTT_BAD_PAYLOAD", topic=msg.topic, error=str(exc))
        except Exception as exc:
            log.error("MQTT_MESSAGE_ERROR", error=str(exc))

    def _on_disconnect(self, client, userdata, rc, properties=None) -> None:
        if rc != 0:
            log.warning("MQTT_DISCONNECTED_UNCLEAN", rc=rc, gw=self.gateway_id)
        else:
            log.info("MQTT_DISCONNECTED", gw=self.gateway_id)
