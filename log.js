/*
 * Logging file
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
        process.on('exit', () => {
            this.logFileStream.end();
        });
    }
    // Method for info logs
    info(...args) {
        const message = Array.from(args).slice(0,-1);
        const data = args[args.length - 1];
        this.logger.info(message,data);
    }
    // Method for error logs
    error(...args) {
        const message = Array.from(args).slice(0,-1);
        const data = args[args.length - 1];
        this.logger.error(message,data);
    }
}

module.exports = { Logger };