export interface Response<T=unknown>{
    success: boolean;
    message?: string;
    data?: T;
}

export interface Request {
    headers?: {
        authorization?: string;
        'x-access-token'?: string;
    };
    body?: Record<string, unknown>;
    parameters?: Record<string, string | undefined>;
}
