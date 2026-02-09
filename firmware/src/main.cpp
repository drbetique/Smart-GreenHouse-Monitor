/**
 * main.cpp - Smart Greenhouse Monitor
 * 
 * HAMK Lepaa Thesis Project
 * "Smart Greenhouse Automation Using IoT and Real-Time
 *  Environmental Sensors for Resource Optimization"
 * 
 * Victor Betiku, 2026
 * Supervised by Ari Hietala
 * Partnership: HAMK LEPAA GREEN HOUSE FACILITY
 * 
 * Hardware: ESP32-DEVKITC-32E
 * Sensors:  SCD30 (CO2/Temp/RH), BH1750 (Light), Capacitive (Soil)
 * Storage:  MicroSD card via SPI (write-first data buffering)
 * Protocol: MQTT over TLS -> InfluxDB
 * Interval: 60 seconds
 */

#include <Arduino.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>
#include <Preferences.h>   
#include "config.h"
#include "wifi_manager.h"
#include "mqtt_manager.h"
#include "time_manager.h"
#include "sensor_manager.h"
#include "sd_manager.h"

// Timing trackers
static unsigned long lastSensorRead = 0;
static unsigned long lastStatusPublish = 0;
static unsigned long readingCount = 0;
static unsigned long publishFailCount = 0;
static uint32_t bootCount = 0;

/**
 * Build JSON payload from sensor readings.
 * 
 * Example output:
 * {
 *   "device": "LEPAA-GH-01",
 *   "timestamp": "2026-03-15T14:30:00+02:00",
 *   "reading": 142,
 *   "sensors": {
 *     "co2": 485.2,
 *     "temperature": 22.15,
 *     "humidity": 65.3,
 *     "light": 12450.0,
 *     "soil_moisture": 42.5,
 *     "soil_raw": 2150
 *   },
 *   "valid": {
 *     "scd30": true,
 *     "bh1750": true,
 *     "soil": true
 *   }
 * }
 */

String generateMessageID() {
    uint64_t chipId = ESP.getEfuseMac();
    uint32_t shortId = (uint32_t)(chipId & 0xFFFFFFFF);
    char msgId[32];
    snprintf(msgId, sizeof(msgId), "%08X-%04u-%05lu", shortId, bootCount, readingCount);
    return String(msgId);
}
String buildDataPayload(const SensorData& data) {
    JsonDocument doc;

    doc["device"] = DEVICE_ID;
    doc["msg_id"] = generateMessageID();
    doc["timestamp"] = TimeManager::getISO8601();
    doc["reading"] = readingCount;

    JsonObject sensors = doc["sensors"].to<JsonObject>();
    if (data.scd30Valid) {
        sensors["co2"] = serialized(String(data.co2, 1));
        sensors["temperature"] = serialized(String(data.temperature, 2));
        sensors["humidity"] = serialized(String(data.humidity, 1));
    }
    if (data.bh1750Valid) {
        sensors["light"] = serialized(String(data.light, 1));
    }
    if (data.soilValid) {
        sensors["soil_moisture"] = serialized(String(data.soilMoisture, 1));
        sensors["soil_raw"] = data.soilRaw;
    }

    JsonObject valid = doc["valid"].to<JsonObject>();
    valid["scd30"] = data.scd30Valid;
    valid["bh1750"] = data.bh1750Valid;
    valid["soil"] = data.soilValid;

    String output;
    serializeJson(doc, output);
    return output;
}

/**
 * Build device status payload.
 */
String buildStatusPayload() {
    JsonDocument doc;

    doc["device"] = DEVICE_ID;
    doc["firmware"] = FIRMWARE_VERSION;
    doc["location"] = LOCATION;
    doc["timestamp"] = TimeManager::getISO8601();
    doc["uptime_sec"] = TimeManager::getUptime();
    doc["readings"] = readingCount;
    doc["publish_failures"] = publishFailCount;
    doc["wifi_rssi"] = WiFiManager::getRSSI();
    doc["wifi_ip"] = WiFiManager::getIP();
    doc["free_heap"] = ESP.getFreeHeap();
    doc["time_synced"] = TimeManager::isSynced();

    // SD card status
    JsonObject sd = doc["sd_card"].to<JsonObject>();
    sd["available"] = SDManager::isAvailable();
    if (SDManager::isAvailable()) {
        sd["total_mb"] = SDManager::getTotalBytes() / (1024 * 1024);
        sd["used_mb"] = SDManager::getUsedBytes() / (1024 * 1024);
        sd["buffered"] = SDManager::getBufferCount();
    }

    String output;
    serializeJson(doc, output);
    return output;
}

void setup() {
    Serial.begin(115200);
    delay(1000);

    Preferences prefs;
    prefs.begin("greenhouse", false);
    bootCount = prefs.getUInt("boots", 0) + 1;
    prefs.putUInt("boots", bootCount);
    prefs.end();

    Serial.println("========================================");
    Serial.println("  Smart Greenhouse Monitor v" FIRMWARE_VERSION);
    Serial.println("  Device: " DEVICE_ID);
    Serial.println("  Location: " LOCATION);
    Serial.println("========================================");

    // Phase 1: Network connectivity
    Serial.println("\n--- Phase 1: WiFi ---");
    WiFiManager::init();

    Serial.println("\n--- Phase 2: Time Sync ---");
    TimeManager::init();

    Serial.println("\n--- Phase 3: MQTT ---");
    MQTTManager::init();

    // Phase 2: Sensors
    Serial.println("\n--- Phase 4: Sensors ---");
    bool sensorsOK = SensorManager::init();
    if (!sensorsOK) {
        Serial.println("[WARN] No sensors initialized! Check wiring.");
        MQTTManager::publishError("No sensors initialized at boot");
    }

    // Phase 3: SD Card
    Serial.println("\n--- Phase 5: SD Card ---");
    bool sdOK = SDManager::init();
    if (!sdOK) {
        Serial.println("[WARN] SD card not available. No local backup.");
        MQTTManager::publishError("SD card not available at boot");
    }

    // Enable watchdog timer
    esp_task_wdt_init(WATCHDOG_TIMEOUT, true);
    esp_task_wdt_add(NULL);

    Serial.println("\n--- Setup Complete ---");
    Serial.printf("Sensor interval: %d ms\n", SENSOR_READ_INTERVAL);
    Serial.printf("Status interval: %d ms\n", STATUS_INTERVAL);
    Serial.println("Entering main loop...\n");

    // Publish initial status
    MQTTManager::publishStatus(buildStatusPayload());
}

void loop() {
    // Reset watchdog
    esp_task_wdt_reset();

    // Maintain connections
    WiFiManager::maintain();
    MQTTManager::maintain();
    TimeManager::maintain();

    unsigned long now = millis();

    // Read and publish sensor data every 60 seconds
    if (now - lastSensorRead >= SENSOR_READ_INTERVAL) {
        lastSensorRead = now;
        readingCount++;

        Serial.printf("\n=== Reading #%lu ===\n", readingCount);

        // Read all sensors
        SensorData data = SensorManager::read();

        // Build JSON payload
        String payload = buildDataPayload(data);
        Serial.printf("[Data] %s\n", payload.c_str());

        // STEP 1: Write to SD card first (local backup)
        bool savedToSD = SDManager::writeReading(payload);
        if (!savedToSD) {
            Serial.println("[WARN] SD write failed. Data only in MQTT.");
        }

        // STEP 2: Try MQTT publish
        if (MQTTManager::isConnected()) {
            if (MQTTManager::publishData(payload)) {
                // Published successfully. Remove from SD buffer.
                if (savedToSD) {
                    SDManager::removeOldestBuffered();
                }
            } else {
                publishFailCount++;
                Serial.printf("[WARN] MQTT publish failed (total: %lu). Data safe on SD.\n", publishFailCount);
            }
        } else {
            publishFailCount++;
            Serial.printf("[WARN] MQTT offline (total: %lu). Data buffered on SD.\n", publishFailCount);
        }

        // STEP 3: Flush old buffered readings if MQTT is back
        if (MQTTManager::isConnected() && SDManager::getBufferCount() > 0) {
            Serial.printf("[Buffer] Flushing %lu buffered readings...\n", SDManager::getBufferCount());
            unsigned int flushed = SDManager::flushBuffer(
                [](const String& p) -> bool {
                    return MQTTManager::publishData(p);
                },
                SD_FLUSH_BATCH
            );
            if (flushed > 0) {
                Serial.printf("[Buffer] Flushed %u readings\n", flushed);
            }
        }
    }

    // Publish status every 5 minutes
    if (now - lastStatusPublish >= STATUS_INTERVAL) {
        lastStatusPublish = now;
        String status = buildStatusPayload();
        MQTTManager::publishStatus(status);
        Serial.printf("[Status] %s\n", status.c_str());
    }

    // Small delay to prevent tight looping
    delay(10);
}
