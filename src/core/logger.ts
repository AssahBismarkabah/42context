import { createWriteStream, WriteStream, statSync, renameSync, readdirSync, unlinkSync } from 'fs';
import { dirname, basename, join } from 'path';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LoggerOptions {
  level?: LogLevel;
  enableConsole?: boolean;
  enableFile?: boolean;
  logFile?: string;
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  timestampFormat?: 'iso' | 'short' | 'long';
}

export class Logger {
  private level: LogLevel;
  private enableConsole: boolean;
  private enableFile: boolean;
  private logFile?: string | undefined;
  private fileStream?: WriteStream | undefined;
  private maxFileSize: number;
  private maxFiles: number;
  private timestampFormat: 'iso' | 'short' | 'long';

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.enableConsole = options.enableConsole ?? true;
    this.enableFile = options.enableFile ?? false;
    this.logFile = options.logFile;
    this.maxFileSize = options.maxFileSize ?? 10 * 1024 * 1024; // 10MB default
    this.maxFiles = options.maxFiles ?? 5;
    this.timestampFormat = options.timestampFormat ?? 'iso';

    if (this.enableFile && this.logFile) {
      this.initializeFileLogging();
    }
  }

  private initializeFileLogging(): void {
    try {
      this.fileStream = createWriteStream(this.logFile!, { flags: 'a' });
    } catch (error) {
      console.error('Failed to initialize file logging:', error);
      this.enableFile = false;
    }
  }

  private getTimestamp(): string {
    const now = new Date();
    
    switch (this.timestampFormat) {
      case 'iso':
        return now.toISOString();
      case 'short':
        return now.toLocaleTimeString();
      case 'long':
        return now.toLocaleString();
      default:
        return now.toISOString();
    }
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = this.getTimestamp();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';
    
    return `[${timestamp}] [${level}] ${message}${formattedArgs}`;
  }

  private write(level: LogLevel, levelName: string, message: string, ...args: any[]): void {
    if (level > this.level) return;

    const formattedMessage = this.formatMessage(levelName, message, ...args);

    // Console output
    if (this.enableConsole) {
      const consoleMethod = level === LogLevel.ERROR ? console.error :
                           level === LogLevel.WARN ? console.warn :
                           level === LogLevel.DEBUG ? console.debug :
                           level === LogLevel.TRACE ? console.trace :
                           console.log;
      
      consoleMethod(formattedMessage);
    }

    // File output
    if (this.enableFile && this.fileStream) {
      this.fileStream.write(formattedMessage + '\n');
      
      // Check if we need to rotate the log file
      this.checkFileRotation();
    }
  }

  private checkFileRotation(): void {
    if (!this.fileStream || !this.logFile) return;

    try {
      const stats = statSync(this.logFile);
      if (stats.size > this.maxFileSize) {
        this.rotateLogFile();
      }
    } catch (error) {
      // Ignore rotation errors
    }
  }

  private rotateLogFile(): void {
    if (!this.fileStream || !this.logFile) return;

    try {
      this.fileStream.end();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFile = `${this.logFile}.${timestamp}`;
      
      renameSync(this.logFile, rotatedFile);
      
      // Clean up old rotated files
      this.cleanupOldLogs();
      
      // Create new log file
      this.fileStream = createWriteStream(this.logFile, { flags: 'a' });
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  private cleanupOldLogs(): void {
    if (!this.logFile) return;

    try {
      const logDir = dirname(this.logFile);
      const logBaseName = basename(this.logFile);
      
      const files = readdirSync(logDir)
        .filter((file: string) => file.startsWith(logBaseName + '.'))
        .sort()
        .reverse();
      
      // Keep only the most recent maxFiles
      const filesToDelete = files.slice(this.maxFiles);
      filesToDelete.forEach((file: string) => {
        unlinkSync(join(logDir, file));
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  error(message: string, ...args: any[]): void {
    this.write(LogLevel.ERROR, 'ERROR', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.write(LogLevel.WARN, 'WARN', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.write(LogLevel.INFO, 'INFO', message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.write(LogLevel.DEBUG, 'DEBUG', message, ...args);
  }

  trace(message: string, ...args: any[]): void {
    this.write(LogLevel.TRACE, 'TRACE', message, ...args);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  close(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = undefined;
    }
  }
}

// Global logger instance
let globalLogger: Logger | null = null;

export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options);
}

export function setGlobalLogger(logger: Logger): void {
  globalLogger = logger;
}

export function getGlobalLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger();
  }
  return globalLogger;
}

// Convenience functions using global logger
export function logError(message: string, ...args: any[]): void {
  getGlobalLogger().error(message, ...args);
}

export function logWarn(message: string, ...args: any[]): void {
  getGlobalLogger().warn(message, ...args);
}

export function logInfo(message: string, ...args: any[]): void {
  getGlobalLogger().info(message, ...args);
}

export function logDebug(message: string, ...args: any[]): void {
  getGlobalLogger().debug(message, ...args);
}

export function logTrace(message: string, ...args: any[]): void {
  getGlobalLogger().trace(message, ...args);
}

export default Logger;