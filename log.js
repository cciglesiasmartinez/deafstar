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
            transport: {
                target: 'pino-pretty'
            },
            level: 'info', // Set logging level
            timestamp: pino.stdTimeFunctions.isoTime, // TStamp format
            streams: [
                { stream: this.logFileStream },
                { stream: process.stdout } 
              ],
        });
        Logger.instance = this; // Saving instance here
    }
    // Method for info logs
    info(...args) {
        const message = Array.from(args).slice(0,-1);
        const data = args[args.length - 1];
        this.logger.info(data, message);
    }
    // Method for error logs
    error(...args) {
        const message = Array.from(args).slice(0,-1);
        const data = args[args.length - 1];
        this.logger.info(data, message);
    }
}

module.exports = { Logger };