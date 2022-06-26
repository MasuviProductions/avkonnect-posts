export class HttpError extends Error {
    statusCode: number;
    errorCode: string | undefined;

    constructor(message: string, statusCode: number, errorCode?: string) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;

        Error.captureStackTrace(this, this.constructor);
    }
}
