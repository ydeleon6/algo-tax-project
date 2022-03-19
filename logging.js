import { createLogger, format, transports } from 'winston';
const { combine, timestamp, label, printf, splat } = format;

export function createNewLogger(sourceName) {
    const myFormat = printf(({ level, message, label, timestamp }) => {
        return `${timestamp} [${label}] ${level}: ${message}`;
    });    
    const logger = createLogger({
        format: combine(
            label({ label: sourceName}),
            timestamp({ format: 'MM/DD/YYYY hh:mm:ss'}),
            splat(),
            myFormat
        ),
        transports: [new transports.File({ filename: 'combined.log' }), new transports.Console()]
    });
    return logger;
}