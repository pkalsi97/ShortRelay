export enum Fault {
    CLIENT = 'client',
    SERVER = 'server'
}

export interface ClientError {
    statusCode: number;
    name: string;
    message: string;
    fault: Fault;
    retryable: boolean;
}

export interface StandardResponse<T> {
    success: boolean;
    message: string;
    data: T;
    error?: ClientError;
}

export interface ApiResponse<T> {
    statusCode: number;
    body: StandardResponse<T>;
}