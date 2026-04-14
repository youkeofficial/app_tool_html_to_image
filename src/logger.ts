import winston from 'winston';

const { combine, timestamp, printf, json, colorize, errors } = winston.format;

// Format clair et coloré pour le développement local
const consoleFormat = combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    printf(({ level, message, timestamp, stack, ...meta }) => {
        let msg = `[${timestamp}] ${level}: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        if (stack) {
            msg += `\n${stack}`;
        }
        return msg;
    })
);

// Format structuré (JSON) pour la production (exploitable par ELK, Datadog, Docker, etc.)
const jsonFormat = combine(
    timestamp(),
    errors({ stack: true }),
    json()
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    // Si on est en "production", on privilégie le JSON pur
    format: process.env.NODE_ENV === 'production' ? jsonFormat : consoleFormat,
    transports: [
        new winston.transports.Console()
    ]
});

export default logger;
