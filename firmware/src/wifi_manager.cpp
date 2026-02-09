/**
 * wifi_manager.cpp - WiFi connection handler
 * 
 * Handles initial connection, automatic reconnection,
 * and connection status monitoring.
 */

#include "wifi_manager.h"
#include "config.h"
#include <WiFi.h>

static unsigned long lastReconnectAttempt = 0;
static int reconnectCount = 0;

void WiFiManager::init() {
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.persistent(true);

    Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < WIFI_MAX_RETRIES) {
        delay(1000);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println(" Connected!");
        Serial.printf("[WiFi] IP: %s\n", WiFi.localIP().toString().c_str());
        Serial.printf("[WiFi] RSSI: %d dBm\n", WiFi.RSSI());
        Serial.printf("[WiFi] MAC: %s\n", WiFi.macAddress().c_str());
        reconnectCount = 0;
    } else {
        Serial.println(" FAILED!");
        Serial.printf("[WiFi] Could not connect after %d attempts. Rebooting...\n", WIFI_MAX_RETRIES);
        delay(2000);
        ESP.restart();
    }
}

bool WiFiManager::maintain() {
    if (WiFi.status() == WL_CONNECTED) {
        reconnectCount = 0;
        return true;
    }

    unsigned long now = millis();
    if (now - lastReconnectAttempt < WIFI_RETRY_DELAY) {
        return false;
    }

    lastReconnectAttempt = now;
    reconnectCount++;

    Serial.printf("[WiFi] Connection lost. Reconnect attempt %d/%d\n", 
                  reconnectCount, WIFI_MAX_RETRIES);

    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    // Wait briefly for connection
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT_MS) {
        delay(100);
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("[WiFi] Reconnected. IP: %s\n", WiFi.localIP().toString().c_str());
        reconnectCount = 0;
        return true;
    }

    if (reconnectCount >= WIFI_MAX_RETRIES) {
        Serial.println("[WiFi] Max retries reached. Rebooting...");
        delay(2000);
        ESP.restart();
    }

    return false;
}

bool WiFiManager::isConnected() {
    return WiFi.status() == WL_CONNECTED;
}

int WiFiManager::getRSSI() {
    return WiFi.RSSI();
}

String WiFiManager::getIP() {
    return WiFi.localIP().toString();
}

String WiFiManager::getMAC() {
    return WiFi.macAddress();
}
