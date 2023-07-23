/*
 * Logging file
 *
 */

const pino = require('pino');
const rotate = require('pino-rotate-file');

class Logger {
  constructor(logFilePath, rotateOptions = {}) {
    if (Logger.instance) {
      return Logger.instance; // Singleton: Returning instance if created
    }
    // File to write 
    this.logFilePath = 'log/app.log';
    // Options for rotation
    this.rotateOptions = {
        size: '10M', 
        keep: 5,
        compress: 'gzip'
    };
    // Configure and instance rotation
    this.logFileStream = rotate(this.logFilePath, this.rotateOptions);
    // Pino options 
    const prettyPrint = {
      colorize: true,
      translateTime: true,
    };

    // Instancing the logger with previous configuration
    this.logger = pino({
      level: 'info', // Set logging level
      prettyPrint,
      timestamp: pino.stdTimeFunctions.isoTime, // TStamp format
    }, this.logFileStream);

    Logger.instance = this; // Saving instance here
  }

  // Method for info logs
  info(message, data = {}) {
    this.logger.info(data, message);
  }

  // Methods for error logs
  error(message, data = {}) {
    this.logger.error(data, message);
  }
}

module.exports = Logger;