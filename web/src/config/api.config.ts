export type ApiService = 'auth' | 'user';

const ENDPOINTS = {
    auth: {
        BASE: process.env.NEXT_PUBLIC_AUTH_API_URL,
        SIGNUP: '/v1/auth/signup',
        LOGIN: '/v1/auth/login',
        LOGOUT: '/v1/auth/logout',
        FORGET_PASSWORD: '/v1/auth/forget-password',
        FORGET_PASSWORD_CONFIRM: '/v1/auth/forget-password/confirm',
        SESSION_REFRESH: '/v1/auth/session/refresh',
    },
    user: {
        BASE: process.env.NEXT_PUBLIC_USER_API_URL,
    },
} as const;

export type EndpointKey<T extends ApiService> = Exclude<keyof typeof ENDPOINTS[T], 'BASE'>;

export const getBaseUrl = (service: ApiService): string => {
    const baseUrl = ENDPOINTS[service].BASE;
    if (!baseUrl) {
        throw new Error(`Base URL not configured for service: ${service}`);
    }
    return baseUrl;
};

export const getApiUrl = <T extends ApiService>(
    service: T,
    endpoint: EndpointKey<T>
): string => {
    return `${getBaseUrl(service)}${ENDPOINTS[service][endpoint]}`;
};

export const API_ROUTES = {
    auth: {
        signup: () => getApiUrl('auth', 'SIGNUP'),
        login: () => getApiUrl('auth', 'LOGIN'),
        logout: () => getApiUrl('auth', 'LOGOUT'),
        forgetPassword: () => getApiUrl('auth', 'FORGET_PASSWORD'),
        forgetPasswordConfirm: () => getApiUrl('auth', 'FORGET_PASSWORD_CONFIRM'),
        sessionRefresh: () => getApiUrl('auth', 'SESSION_REFRESH'),
    },
    user: {
    },
} as const;

export const ENDPOINTS_CONFIG = ENDPOINTS;