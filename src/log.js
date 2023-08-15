/*
 * Logging Utility
 *
 * This file defines the Logger class, which manages application logging. The class
 * initializes a logging instance with specified configurations, including log file
 * path, options, and log levels. It provides methods for both logging informational
 * messages and error messages.
 *
 */

const pino = require('pino');
const pretty = require('pino-pretty');
const fs = require('fs');

class Logger {
    constructor() {
        if (Logger.instance) {
            return Logger.instance; // Singleton: Returning instance if created
        }
        // Basic parameters
        this.logFilePath = 'app.log';
        this.logFileOptions = {
            flags: 'a',
        }
        // Creating file stream
        this.logFileStream = fs.createWriteStream(this.logFilePath, this.logFileOptions);
        // Defining multistream array
        this.streams = [
            { stream: this.logFileStream },
            { stream: pretty() },
        ],
        // Instancing the logger with previous configuration
        this.logger = pino({
            level: 'info', // Set logging level
            timestamp: pino.stdTimeFunctions.isoTime, // TStamp format
            
        }, pino.multistream(this.streams));
        Logger.instance = this; // Saving instance here
    }
    // Method for info logs
    info(data) {
        this.logger.info(data);
    }
    // Method for error logs
    error(data) {
        this.logger.error(data);
    }
}

module.exports = { Logger };