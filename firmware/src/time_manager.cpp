/**
 * time_manager.cpp - NTP time synchronization
 * 
 * Syncs with NTP servers and provides ISO 8601 timestamps
 * in Europe/Helsinki timezone (EET/EEST).
 */

#include "time_manager.h"
#include "config.h"
#include <time.h>

static bool timeSynced = false;
static unsigned long lastSyncTime = 0;
static unsigned long bootTime = 0;

void TimeManager::init() {
    bootTime = millis();

    // Configure timezone and NTP servers
    configTime(NTP_GMT_OFFSET, NTP_DST_OFFSET, NTP_SERVER_1, NTP_SERVER_2);

    Serial.print("[Time] Syncing with NTP");

    // Wait for time sync (max 10 seconds)
    struct tm timeinfo;
    int attempts = 0;
    while (!getLocalTime(&timeinfo) && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (getLocalTime(&timeinfo)) {
        timeSynced = true;
        lastSyncTime = millis();
        Serial.println(" Synced!");
        Serial.printf("[Time] Current time: %s\n", getISO8601().c_str());
    } else {
        Serial.println(" FAILED! Timestamps will use millis().");
    }
}

void TimeManager::maintain() {
    // Re-sync periodically
    if (millis() - lastSyncTime > NTP_SYNC_INTERVAL) {
        configTime(NTP_GMT_OFFSET, NTP_DST_OFFSET, NTP_SERVER_1, NTP_SERVER_2);
        lastSyncTime = millis();

        struct tm timeinfo;
        if (getLocalTime(&timeinfo)) {
            timeSynced = true;
            Serial.printf("[Time] Re-synced: %s\n", getISO8601().c_str());
        }
    }
}

String TimeManager::getISO8601() {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
        // Fallback: return millis-based timestamp
        return "1970-01-01T00:00:00+00:00";
    }

    char buffer[30];
    // Determine current UTC offset (handles DST automatically)
    int totalOffset = NTP_GMT_OFFSET + (timeinfo.tm_isdst > 0 ? NTP_DST_OFFSET : 0);
    int offsetHours = totalOffset / 3600;
    int offsetMinutes = (totalOffset % 3600) / 60;

    snprintf(buffer, sizeof(buffer),
             "%04d-%02d-%02dT%02d:%02d:%02d+%02d:%02d",
             timeinfo.tm_year + 1900,
             timeinfo.tm_mon + 1,
             timeinfo.tm_mday,
             timeinfo.tm_hour,
             timeinfo.tm_min,
             timeinfo.tm_sec,
             offsetHours,
             abs(offsetMinutes));

    return String(buffer);
}

unsigned long TimeManager::getEpoch() {
    time_t now;
    time(&now);
    return (unsigned long)now;
}

bool TimeManager::isSynced() {
    return timeSynced;
}

unsigned long TimeManager::getUptime() {
    return (millis() - bootTime) / 1000;
}
