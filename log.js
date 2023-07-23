/*
 * Logging file
 *
 */

const pino = require('pino');
const fs = require('fs');

class Logger {
    constructor() {
        if (Logger.instance) {
            return Logger.instance; // Singleton: Returning instance if created
        }
        // Basic parameters
        this.logFilePath = 'log/app.log';
        this.logFileOptions = {
            flags: 'a',
        }
        // Creating stream
        this.logFileStream = fs.createWriteStream(this.logFilePath, this.logFileOptions);
        // Instancing the logger with previous configuration
        this.logger = pino({
            level: 'info', // Set logging level
            timestamp: pino.stdTimeFunctions.isoTime, // TStamp format
        }, this.logFileStream);
        Logger.instance = this; // Saving instance here
    }
    // Method for info logs
    info(message, data = {}) {
        console.log(message);
        this.logger.info(data, message);
    }
    // Methods for error logs
    error(message, data = {}) {
        console.log(message);
        this.logger.error(data, message);
    }
}

module.exports = { Logger };