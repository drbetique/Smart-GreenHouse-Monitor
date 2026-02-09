/**
 * sd_manager.h - SD card logging and data buffering
 * 
 * Write-first architecture: every sensor reading goes to SD
 * before MQTT publish. If MQTT fails, data stays buffered.
 * When connectivity returns, buffered data is flushed.
 */

#ifndef SD_MANAGER_H
#define SD_MANAGER_H

#include <Arduino.h>

namespace SDManager {
    /**
     * Initialize SD card and create directory structure.
     * Returns true if SD card is mounted and writable.
     */
    bool init();

    /**
     * Write a sensor reading to the buffer file (JSONL format).
     * Each line is one complete JSON object.
     * Returns true if write succeeded.
     */
    bool writeReading(const String& jsonPayload);

    /**
     * Get number of buffered (unpublished) readings.
     */
    unsigned long getBufferCount();

    /**
     * Read the next buffered reading without removing it.
     * Returns empty string if buffer is empty.
     */
    String peekNextBuffered();

    /**
     * Remove the oldest buffered reading after successful publish.
     * Returns true if removal succeeded.
     */
    bool removeOldestBuffered();

    /**
     * Flush up to 'batchSize' buffered readings via a callback.
     * The callback should attempt MQTT publish and return true on success.
     * Returns number of readings successfully flushed.
     */
    unsigned int flushBuffer(bool (*publishCallback)(const String& payload), unsigned int batchSize);

    /**
     * Get SD card status info.
     */
    bool isAvailable();
    unsigned long getTotalBytes();
    unsigned long getUsedBytes();
    String getStatusJSON();
}

#endif // SD_MANAGER_H
