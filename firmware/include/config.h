/**
 * config.h - Configuration for Smart Greenhouse Monitor
 * 
 * HAMK Lepaa Thesis Project
 * Victor Betiku, 2026
 * 
 * IMPORTANT: Do NOT commit this file with real credentials.
 * Copy to config_local.h and add config_local.h to .gitignore.
 */

#ifndef CONFIG_H
#define CONFIG_H

// ============================================================
// WiFi Configuration
// ============================================================
#define WIFI_SSID         "GREENHOUSE"    // Update with Lepaa WiFi SSID
#define WIFI_PASSWORD     "CHANGE_ME"           // Update with Lepaa WiFi password
#define WIFI_TIMEOUT_MS   10000                 // Connection timeout: 10 seconds
#define WIFI_RETRY_DELAY  5000                  // Retry delay: 5 seconds
#define WIFI_MAX_RETRIES  10                    // Max connection attempts before reboot

// ============================================================
// MQTT Configuration
// ============================================================
#define MQTT_BROKER       "BROKER IP"       // Hetzner VPS (Helsinki)
#define MQTT_PORT         8883                  // TLS port (use 1883 for non-TLS)
#define MQTT_USER         "greenhouse"          // MQTT username
#define MQTT_PASSWORD     "CHNAGEME" // MQTT password
#define MQTT_CLIENT_ID    "lepaa-greenhouse-01" // Unique client ID
#define MQTT_TOPIC_DATA   "greenhouse/lepaa/sensors"
#define MQTT_TOPIC_STATUS "greenhouse/lepaa/status"
#define MQTT_TOPIC_ERROR  "greenhouse/lepaa/errors"
#define MQTT_KEEPALIVE    60                    // Keepalive interval in seconds
#define MQTT_QOS          1                     // QoS level for sensor data
#define MQTT_BUFFER_SIZE  512                   // MQTT message buffer size

// ============================================================
// NTP Configuration
// ============================================================
#define NTP_SERVER_1      "pool.ntp.org"
#define NTP_SERVER_2      "time.google.com"
#define NTP_GMT_OFFSET    7200                  // Finland EET: UTC+2 (seconds)
#define NTP_DST_OFFSET    3600                  // DST offset: +1 hour (seconds)
#define NTP_SYNC_INTERVAL 3600000               // Re-sync every hour (ms)

// ============================================================
// Sensor Configuration
// ============================================================

// SCD30 - CO2, Temperature, Humidity (I2C)
#define SCD30_I2C_ADDR    0x61
#define SCD30_INTERVAL    2                     // Measurement interval in seconds

// BH1750 - Light Intensity (I2C)
#define BH1750_I2C_ADDR   0x23
#define BH1750_MODE       0x10                  // Continuous high-res mode

// Soil Moisture - Analog
#define SOIL_PIN          34                    // ADC1 channel 6 (GPIO34)
#define SOIL_AIR_VALUE    3500                  // Raw ADC reading in dry air
#define SOIL_WATER_VALUE  1500                  // Raw ADC reading in water
#define SOIL_SAMPLES      10                    // Number of readings to average

// I2C Pins
#define I2C_SDA           21
#define I2C_SCL           22

// ============================================================
// SD Card Configuration (SPI)
// ============================================================
#define SD_CS_PIN         5                     // Chip select (GPIO5)
#define SD_SCK_PIN        18                    // SPI clock
#define SD_MOSI_PIN       23                    // SPI MOSI
#define SD_MISO_PIN       19                    // SPI MISO
#define SD_LOG_DIR        "/data"               // Log directory
#define SD_BUFFER_FILE    "/data/buffer.jsonl"  // Buffered readings (JSONL format)
#define SD_ARCHIVE_DIR    "/data/archive"       // Published data archive
#define SD_FLUSH_BATCH    10                    // Publish this many buffered readings per loop
#define SD_MAX_FILE_SIZE  5242880               // 5 MB max per log file before rotation

// ============================================================
// Timing Configuration
// ============================================================
#define SENSOR_READ_INTERVAL  60000             // Read sensors every 60 seconds (ms)
#define STATUS_INTERVAL       300000            // Publish status every 5 minutes (ms)
#define WATCHDOG_TIMEOUT      120               // Watchdog timeout: 120 seconds

// ============================================================
// Device Info
// ============================================================
#define DEVICE_ID         "LEPAA-GH-01"
#define FIRMWARE_VERSION  "1.0.0"
#define LOCATION          "Lepaa Greenhouse - Strawberry Section"

#endif // CONFIG_H
