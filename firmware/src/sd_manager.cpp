/**
 * sd_manager.cpp - SD card logging and data buffering
 * 
 * Architecture:
 * 1. Every reading writes to /data/buffer.jsonl (append)
 * 2. After successful MQTT publish, the reading is removed from buffer
 * 3. If MQTT is down, readings accumulate in buffer
 * 4. When MQTT recovers, buffered readings flush in batches
 * 5. Daily log files in /data/archive/ keep a permanent copy
 * 
 * File format: JSONL (one JSON object per line, newline-delimited)
 */

#include "sd_manager.h"
#include "config.h"
#include "time_manager.h"
#include <SD.h>
#include <SPI.h>

static bool sdAvailable = false;
static unsigned long bufferCount = 0;
static String currentArchiveFile = "";

/**
 * Create directory if it does not exist.
 */
static bool ensureDir(const char* path) {
    if (SD.exists(path)) return true;
    return SD.mkdir(path);
}

/**
 * Get archive filename based on current date.
 * Format: /data/archive/2026-03-15.jsonl
 */
static String getArchiveFilename() {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
        return String(SD_ARCHIVE_DIR) + "/unknown.jsonl";
    }
    char buf[40];
    snprintf(buf, sizeof(buf), "%s/%04d-%02d-%02d.jsonl",
             SD_ARCHIVE_DIR,
             timeinfo.tm_year + 1900,
             timeinfo.tm_mon + 1,
             timeinfo.tm_mday);
    return String(buf);
}

/**
 * Count lines in buffer file.
 */
static unsigned long countLines(const char* path) {
    if (!SD.exists(path)) return 0;

    File f = SD.open(path, FILE_READ);
    if (!f) return 0;

    unsigned long count = 0;
    while (f.available()) {
        String line = f.readStringUntil('\n');
        line.trim();
        if (line.length() > 0) count++;
    }
    f.close();
    return count;
}

bool SDManager::init() {
    Serial.print("[SD] Initializing... ");

    SPI.begin(SD_SCK_PIN, SD_MISO_PIN, SD_MOSI_PIN, SD_CS_PIN);

    if (!SD.begin(SD_CS_PIN)) {
        Serial.println("FAILED! Check wiring and card.");
        sdAvailable = false;
        return false;
    }

    uint8_t cardType = SD.cardType();
    if (cardType == CARD_NONE) {
        Serial.println("No card inserted.");
        sdAvailable = false;
        return false;
    }

    const char* typeStr = "UNKNOWN";
    if (cardType == CARD_MMC)  typeStr = "MMC";
    if (cardType == CARD_SD)   typeStr = "SD";
    if (cardType == CARD_SDHC) typeStr = "SDHC";

    Serial.printf("OK (%s, %lluMB)\n", typeStr, SD.totalBytes() / (1024 * 1024));

    // Create directory structure
    ensureDir(SD_LOG_DIR);
    ensureDir(SD_ARCHIVE_DIR);

    // Count existing buffered readings
    bufferCount = countLines(SD_BUFFER_FILE);
    if (bufferCount > 0) {
        Serial.printf("[SD] Found %lu buffered readings from previous session\n", bufferCount);
    }

    sdAvailable = true;
    return true;
}

bool SDManager::writeReading(const String& jsonPayload) {
    if (!sdAvailable) return false;

    // Write to buffer file (unpublished readings)
    File bufferFile = SD.open(SD_BUFFER_FILE, FILE_APPEND);
    if (!bufferFile) {
        Serial.println("[SD] Failed to open buffer file");
        return false;
    }
    bufferFile.println(jsonPayload);
    bufferFile.close();
    bufferCount++;

    // Write to daily archive (permanent record)
    String archivePath = getArchiveFilename();
    File archiveFile = SD.open(archivePath.c_str(), FILE_APPEND);
    if (archiveFile) {
        archiveFile.println(jsonPayload);
        archiveFile.close();
    }

    Serial.printf("[SD] Reading saved (buffer: %lu)\n", bufferCount);
    return true;
}

unsigned long SDManager::getBufferCount() {
    return bufferCount;
}

String SDManager::peekNextBuffered() {
    if (!sdAvailable || bufferCount == 0) return "";

    File f = SD.open(SD_BUFFER_FILE, FILE_READ);
    if (!f) return "";

    String line = f.readStringUntil('\n');
    f.close();
    line.trim();
    return line;
}

bool SDManager::removeOldestBuffered() {
    if (!sdAvailable || bufferCount == 0) return false;

    // Read all lines except the first
    File f = SD.open(SD_BUFFER_FILE, FILE_READ);
    if (!f) return false;

    // Skip first line
    f.readStringUntil('\n');

    // Read remaining lines into memory
    String remaining = "";
    while (f.available()) {
        String line = f.readStringUntil('\n');
        line.trim();
        if (line.length() > 0) {
            remaining += line + "\n";
        }
    }
    f.close();

    // Rewrite buffer file without the first line
    SD.remove(SD_BUFFER_FILE);
    if (remaining.length() > 0) {
        File newFile = SD.open(SD_BUFFER_FILE, FILE_WRITE);
        if (newFile) {
            newFile.print(remaining);
            newFile.close();
        }
    }

    bufferCount--;
    return true;
}

unsigned int SDManager::flushBuffer(bool (*publishCallback)(const String& payload), unsigned int batchSize) {
    if (!sdAvailable || bufferCount == 0) return 0;

    unsigned int flushed = 0;

    // Read all buffered lines
    File f = SD.open(SD_BUFFER_FILE, FILE_READ);
    if (!f) return 0;

    // Collect all lines
    std::vector<String> lines;
    while (f.available()) {
        String line = f.readStringUntil('\n');
        line.trim();
        if (line.length() > 0) {
            lines.push_back(line);
        }
    }
    f.close();

    if (lines.empty()) {
        bufferCount = 0;
        return 0;
    }

    // Try to publish oldest readings first
    unsigned int publishedUpTo = 0;
    for (unsigned int i = 0; i < lines.size() && flushed < batchSize; i++) {
        if (publishCallback(lines[i])) {
            flushed++;
            publishedUpTo = i + 1;
        } else {
            // Stop on first failure
            break;
        }
    }

    // Rewrite buffer file with remaining unpublished lines
    if (publishedUpTo > 0) {
        SD.remove(SD_BUFFER_FILE);

        if (publishedUpTo < lines.size()) {
            File newFile = SD.open(SD_BUFFER_FILE, FILE_WRITE);
            if (newFile) {
                for (unsigned int i = publishedUpTo; i < lines.size(); i++) {
                    newFile.println(lines[i]);
                }
                newFile.close();
            }
        }

        bufferCount = lines.size() - publishedUpTo;
        Serial.printf("[SD] Flushed %u readings, %lu remaining\n", flushed, bufferCount);
    }

    return flushed;
}

bool SDManager::isAvailable() {
    return sdAvailable;
}

unsigned long SDManager::getTotalBytes() {
    if (!sdAvailable) return 0;
    return SD.totalBytes();
}

unsigned long SDManager::getUsedBytes() {
    if (!sdAvailable) return 0;
    return SD.usedBytes();
}

String SDManager::getStatusJSON() {
    String json = "{";
    json += "\"available\":" + String(sdAvailable ? "true" : "false");
    if (sdAvailable) {
        json += ",\"total_mb\":" + String(SD.totalBytes() / (1024 * 1024));
        json += ",\"used_mb\":" + String(SD.usedBytes() / (1024 * 1024));
        json += ",\"buffered\":" + String(bufferCount);
    }
    json += "}";
    return json;
}
