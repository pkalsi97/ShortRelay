import { Request } from '../types/request-response.types';

export enum ValidationField{
    RequestBody = 'REQUEST_BODY',
    Email = 'EMAIL',
    Password = 'PASSWORD',
    RequestHeaders = 'REQUEST_HEADERS',
    RefreshToken = 'REFRESH_TOKEN',
    AccessToken = 'ACCESS_TOKEN',
    OTP = 'OTP'
};

type ValidationValue = string | number | boolean | object | null | undefined;

interface ValidationRule {
    validate: (value:ValidationValue) => boolean;
    message: string;
}

export interface ValidationResponse {
    success: boolean;
    message?: string;
}

const ValidationRules: Record<ValidationField, ValidationRule> = {
    [ValidationField.RequestBody]: {
        validate: (value: ValidationValue) => value !== undefined && value !== null,
        message: 'Request body is required',
    },

    [ValidationField.RequestHeaders]: {
        validate: (value: ValidationValue) => value !== undefined && value !==null,
        message: 'Headers are missing',
    },

    [ValidationField.Email]: {
        validate: (email: ValidationValue) => {
            if (!email || typeof email !== 'string') {
                return false;
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        },
        message: 'Invalid email format',
    },

    [ValidationField.Password]: {
        validate: (password: ValidationValue) => {
            if (!password || typeof password !== 'string'|| password.trim().length === 0) {
                return false;
            }
            return true;
        },
        message: 'Password is required',
    },

    [ValidationField.OTP]: {
        validate: (otp: ValidationValue) => {
            if (!otp || typeof otp !== 'string'|| otp.trim().length === 0){
                return false;
            }
            return true;
        },
        message: 'Otp is Required or Invalid',
    },

    [ValidationField.RefreshToken]: {
        validate: (token: ValidationValue) => {
            if (!token){
                return false;
            }
            return true;
        },
        message: 'Invalid refresh token format',
    },

    [ValidationField.AccessToken]: {
        validate: (token: ValidationValue) => {
            if (!token || typeof token !== 'string') {
                return false;
            }
            if (!token.startsWith('Bearer ')) {
                return false;
            }
            const tokenValue = token.split('Bearer ')[1];
            if (!tokenValue || tokenValue.trim().length === 0) {
                return false;
            }
            return true;
        },
        message: 'Invalid access token format',
    },
};

/**
 * Validates specified fields in the request
 * @param request - The request object to validate
 * @param fields - Array of fields to validate
 * @returns ValidationResponse indicating success or failure
*/

const validate = (request: Request, fields: ValidationField[]): ValidationResponse => {
    for (const field of fields) {
        const value = getValueFromRequest(request, field);
        const rule = ValidationRules[field];
        if (!rule.validate(value)) {
            return {
                success: false,
                message: rule.message,
            };
        }
    }

    return { success: true };
};

const getValueFromRequest = (request: Request, field: ValidationField): ValidationValue => {
    if (!request) {
        return undefined;
    }
    const path = requestFieldPaths[field];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return path?.split('.').reduce<any>((obj, key) => {
        if (typeof obj === 'object' && obj !== null) {
            return obj[key];
        }
        return undefined;
    }, request);
};

const requestFieldPaths: Record<ValidationField, string> = {
    [ValidationField.RequestBody]: 'body',
    [ValidationField.Email]: 'body.email',
    [ValidationField.Password]: 'body.password',
    [ValidationField.AccessToken]: 'headers.x-access-token',
    [ValidationField.RefreshToken]: 'body.refreshToken',
    [ValidationField.RequestHeaders]: 'headers',
    [ValidationField.OTP]: 'body.answer',
};

export const RequestValidator = {
    validate,
};
