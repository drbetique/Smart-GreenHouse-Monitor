/**
 * time_manager.h - NTP time synchronization
 */

#ifndef TIME_MANAGER_H
#define TIME_MANAGER_H

#include <Arduino.h>

namespace TimeManager {
    /**
     * Initialize NTP time sync for Europe/Helsinki timezone.
     * Must be called after WiFi is connected.
     */
    void init();

    /**
     * Periodic re-sync with NTP server.
     * Call in main loop.
     */
    void maintain();

    /**
     * Get current time as ISO 8601 string.
     * Format: 2026-03-15T14:30:00+02:00
     */
    String getISO8601();

    /**
     * Get Unix timestamp (seconds since epoch).
     */
    unsigned long getEpoch();

    /**
     * Check if time has been synced at least once.
     */
    bool isSynced();

    /**
     * Get uptime in seconds since boot.
     */
    unsigned long getUptime();
}

#endif // TIME_MANAGER_H
