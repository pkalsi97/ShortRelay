export enum Fault {
    CLIENT = 'Client',
    SERVER = 'Server',
}

export enum ErrorName {
    InternalError = 'InternalServerError',
    ValidationError = 'ValidationError',
    BadRequestError = 'BadRequestError',
}

interface ClientResponse {
    statusCode: number;
    name: string;
    message: string;
    fault: Fault;
    retryable: boolean;
}

interface AWSServiceError {
    $response?: { statusCode?: number };
    $fault?: string;
    $retryable?: boolean;
    $metadata?: {
        attempts?: number;
        cfId?: string;
        extendedRequestId?: string;
        requestId?: string;
        totalRetryDelay?: number;
    };
}

export const exceptionHandlerFunction = (error: unknown): ClientResponse => {

    const clientResponse: ClientResponse = {
        statusCode:(error as AWSServiceError)?.$response?.statusCode || 500,
        name:(error as Error)?.name || ErrorName.InternalError,
        message:(error as Error)?.message || 'An unknown error occurred',
        fault:(error as AWSServiceError)?.$fault === 'client' ? Fault.CLIENT : Fault.SERVER,
        retryable:(error as AWSServiceError)?.$retryable || false,
    };

    if (error instanceof CustomError) {
        clientResponse.statusCode = error.statusCode;
        clientResponse.name = error.name;
        clientResponse.message = error.message;
        clientResponse.fault = error.fault;
        clientResponse.retryable = error.retryable;
    }

    console.error(error);

    return clientResponse;
};

export class CustomError extends Error {
    public name: ErrorName;
    public statusCode: number;
    public fault: Fault;
    public retryable: boolean;

    public constructor(
        name: ErrorName,
        message: string = 'Unknown Error!',
        statusCode: number,
        fault: Fault = Fault.SERVER,
        retryable: boolean,
    ){
        super(message);
        this.name = name;
        this.statusCode = statusCode;
        this.fault = fault;
        this.retryable = retryable;
        Object.setPrototypeOf(this, new.target.prototype);
    };
}
