/**
 * mqtt_manager.cpp - MQTT client with TLS support
 * 
 * Uses WiFiClientSecure for encrypted connections.
 * Handles automatic reconnection with backoff.
 */

#include "mqtt_manager.h"
#include "config.h"
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

// Root CA certificate for your MQTT broker
// Replace with your broker's CA certificate
static const char* ROOT_CA PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDETCCAfmgAwIBAgIUdws3suIOwiTcZ8ZPgbKmLgVRz4gwDQYJKoZIhvcNAQEL
BQAwGDEWMBQGA1UEAwwNR3JlZW5ob3VzZSBDQTAeFw0yNjAyMDgxNTM5MTRaFw0y
NzAyMDgxNTM5MTRaMBgxFjAUBgNVBAMMDUdyZWVuaG91c2UgQ0EwggEiMA0GCSqG
SIb3DQEBAQUAA4IBDwAwggEKAoIBAQC75pSMSBe61gmhLNV3T3TOD0dZ0pZtniEZ
7Xn7fGlcH56dOnriAcjfP+5LcCyeKOA7DZ3k2riTIPYg17ynWy+mKNmB0CU+b2IT
Go/+EP/7lzxL6aynMttbtMN7VlG+bGG6NdO5oWea9EkqYoGIEk3ZToaKzL/gSqQ5
BCAEo2jrWUKSOOlYUvqO4oX3JzkKI4uMBKzWdjst1OaVUoJLjta4UkkV/eo0ZQc2
00+/f6PcdFnTX8LhpNNA5Kn+1qKXJ9GAMNMbAZ73F31K+11YilewuK4h/mmjwBnv
UA3+nrrciSjSKCpbwRyU000j2GslKXPFsztKtNZL2EqkLhVYGUbTAgMBAAGjUzBR
MB0GA1UdDgQWBBTfCW+V3ucmSvYu6LBGj2RiBt2p0zAfBgNVHSMEGDAWgBTfCW+V
3ucmSvYu6LBGj2RiBt2p0zAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUA
A4IBAQAeH/ci340lx8AQyoDmfWE2/Lxxg+QxLysL0Q5AqH1pROpTK+s9bj6KaaHN
2xj0a/Ndp9hLmI/qR2Xea7RSqZSisjje+fWmYu6pS8NsG5EGZjOYHuvtqZxfrWRI
xEIn4xVAHcxMpmaPOirBvvtD37sSEwYLcYNT/Zw/yBR+4Vg/Ntixqtps199HHMAE
VK+wQZ+RioxeFFq/15QgBuAWQHbPjsC3MCPRWDcBZ2PugZWFG+r6uTl0UhRl0+Ai
GzyN8zXNp0xEbHNWqgHSwz1ihWtjlxrmfJY65YYEKHqmT0Bg7OArJnPDJpX5Aq21
qANiNNoawRyh/AWuxt+YJ0hwQTsa
-----END CERTIFICATE-----
)EOF";

static WiFiClientSecure espClient;
static PubSubClient mqttClient(espClient);
static unsigned long lastReconnectAttempt = 0;
static int reconnectCount = 0;

// MQTT callback for incoming messages (if needed)
static void mqttCallback(char* topic, byte* payload, unsigned int length) {
    Serial.printf("[MQTT] Message on topic: %s\n", topic);
    // Handle incoming commands here if needed
}

static bool connectToBroker() {
    Serial.printf("[MQTT] Connecting to %s:%d...\n", MQTT_BROKER, MQTT_PORT);

    // Last Will and Testament: publish offline status if connection drops
    String willPayload = "{\"device\":\"" + String(DEVICE_ID) + "\",\"status\":\"offline\"}";

    bool connected = mqttClient.connect(
        MQTT_CLIENT_ID,
        MQTT_USER,
        MQTT_PASSWORD,
        MQTT_TOPIC_STATUS,          // Will topic
        MQTT_QOS,                   // Will QoS
        true,                       // Will retain
        willPayload.c_str()         // Will message
    );

    if (connected) {
        Serial.println("[MQTT] Connected!");
        reconnectCount = 0;

        // Publish online status
        String onlineMsg = "{\"device\":\"" + String(DEVICE_ID) + "\",\"status\":\"online\",\"firmware\":\"" + String(FIRMWARE_VERSION) + "\"}";
        mqttClient.publish(MQTT_TOPIC_STATUS, onlineMsg.c_str(), true);

        return true;
    }

    Serial.printf("[MQTT] Connection failed. State: %d\n", mqttClient.state());
    return false;
}

void MQTTManager::init() {
    // Configure TLS
    espClient.setCACert(ROOT_CA);

    // For development/testing without certificate verification:
    // espClient.setInsecure();    // REMOVE THIS IN PRODUCTION

    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);
    mqttClient.setBufferSize(MQTT_BUFFER_SIZE);
    mqttClient.setKeepAlive(MQTT_KEEPALIVE);

    connectToBroker();
}

bool MQTTManager::maintain() {
    if (mqttClient.connected()) {
        mqttClient.loop();
        return true;
    }

    // Exponential backoff for reconnection
    unsigned long now = millis();
    unsigned long backoff = min((unsigned long)(2000 * (1 << reconnectCount)), (unsigned long)30000);

    if (now - lastReconnectAttempt < backoff) {
        return false;
    }

    lastReconnectAttempt = now;
    reconnectCount++;

    Serial.printf("[MQTT] Reconnect attempt %d (backoff: %lu ms)\n", reconnectCount, backoff);

    if (connectToBroker()) {
        return true;
    }

    if (reconnectCount > 10) {
        Serial.println("[MQTT] Too many failed attempts. Rebooting...");
        delay(2000);
        ESP.restart();
    }

    return false;
}

bool MQTTManager::publishData(const String& payload) {
    if (!mqttClient.connected()) {
        Serial.println("[MQTT] Not connected. Data not published.");
        return false;
    }

    bool success = mqttClient.publish(MQTT_TOPIC_DATA, payload.c_str(), false);
    if (success) {
        Serial.printf("[MQTT] Data published (%d bytes)\n", payload.length());
    } else {
        Serial.println("[MQTT] Publish failed!");
    }
    return success;
}

bool MQTTManager::publishStatus(const String& payload) {
    if (!mqttClient.connected()) return false;
    return mqttClient.publish(MQTT_TOPIC_STATUS, payload.c_str(), true);
}

bool MQTTManager::publishError(const String& errorMsg) {
    if (!mqttClient.connected()) return false;
    String payload = "{\"device\":\"" + String(DEVICE_ID) + "\",\"error\":\"" + errorMsg + "\"}";
    return mqttClient.publish(MQTT_TOPIC_ERROR, payload.c_str(), false);
}

bool MQTTManager::isConnected() {
    return mqttClient.connected();
}
