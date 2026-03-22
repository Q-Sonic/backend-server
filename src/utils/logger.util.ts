/**
 * Utility for structured and color-coded logging.
 * Using console for simplicity, but easily switchable to Winston/Pino.
 */
export class Logger {
    private static readonly COLORS = {
        reset: "\x1b[0m",
        bright: "\x1b[1m",
        dim: "\x1b[2m",
        fgRed: "\x1b[31m",
        fgGreen: "\x1b[32m",
        fgYellow: "\x1b[33m",
        fgBlue: "\x1b[34m",
        fgCyan: "\x1b[36m",
        fgGray: "\x1b[90m",
    };

    private static formatTag(tag: string, color: string): string {
        return `${color}${this.COLORS.bright}[${tag}]${this.COLORS.reset}`;
    }

    private static getTime(): string {
        return new Date().toISOString();
    }

    private static log(level: string, tag: string, color: string, message: string, data?: any) {
        const time = `${this.COLORS.fgGray}${this.getTime()}${this.COLORS.reset}`;
        const tagFormatted = this.formatTag(tag, color);
        const dataStr = data ? `\n${JSON.stringify(data, null, 2)}` : "";
        
        console.log(`${time} ${tagFormatted} ${message}${dataStr}`);
    }

    static info(message: string, data?: any) {
        this.log("INFO", "INFO", this.COLORS.fgBlue, message, data);
    }

    static success(message: string, data?: any) {
        this.log("SUCCESS", "SUCCESS", this.COLORS.fgGreen, message, data);
    }

    static warn(message: string, data?: any) {
        this.log("WARN", "WARN", this.COLORS.fgYellow, message, data);
    }

    static error(message: string, error?: any, data?: any) {
        const errorData = error instanceof Error ? {
            stack: error.stack,
            message: error.message,
            ...data
        } : { error, ...data };

        this.log("ERROR", "ERROR", this.COLORS.fgRed, message, errorData);
    }

    static auth(message: string, data?: any) {
        this.log("AUTH", "AUTH", this.COLORS.fgCyan, message, data);
    }

    static process(message: string, data?: any) {
        this.log("PROC", "PROC", this.COLORS.fgGray, message, data);
    }

    static db(message: string, data?: any) {
        this.log("DB", "DB", this.COLORS.fgYellow, message, data);
    }
}
