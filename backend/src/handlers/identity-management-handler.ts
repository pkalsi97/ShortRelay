import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { AuthConfig, IdentityService } from '../services/auth/identity-service';
import { Request, Response } from '../types/request-response.types';
import { Fault, CustomError, ErrorName, exceptionHandlerFunction } from '../utils/error-handling';
import { ValidationField, ValidationResponse, RequestValidator } from '../utils/request-validator';

const ROUTES = {
    SIGN_UP: '/v1/auth/signup',
    LOGIN: '/v1/auth/login',
    LOGOUT: '/v1/auth/logout',
    FORGET_PASSWORD: '/v1/auth/forget-password',
    FORGET_PASSWORD_CONFIRM: '/v1/auth/forget-password/confirm',
    SESSION_REFRESH: '/v1/auth/session/refresh',
} as const;

// Initialize
const authConfig: AuthConfig = {
    userPoolId: process.env.USER_POOL_ID!,
    clientId: process.env.CLIENT_ID!,
    region: process.env.AWS_DEFAULT_REGION!,
};

IdentityService.initialize(authConfig);

/**
 * signupFunc expects
 * @param email
 * @param password
 * @returns Response
*/

const signupFunc = async (request: Request): Promise<Response> => {
    const validationResult:ValidationResponse = RequestValidator.validate(request, [
        ValidationField.RequestBody,
        ValidationField.Email,
        ValidationField.Password,
    ]);

    if (!validationResult.success){
        throw new CustomError(ErrorName.ValidationError, validationResult.message, 400, Fault.CLIENT, true);
    }

    const { email, password } = request.body!;

    const createUserResponse = await IdentityService.createUser(email as string, password as string);
    if (!createUserResponse){
        throw new CustomError(ErrorName.InternalError, 'Signup Failed,Try Again Later!', 500, Fault.SERVER, true);
    }

    return {
        success: true,
        message: 'Signup Successful',
    };
};

/**
 * loginFunc expects
 * @param email
 * @param password
 * @returns Response
*/

const loginFunc= async (request: Request): Promise<Response> => {
    const validationResult: ValidationResponse = RequestValidator.validate(request, [
        ValidationField.RequestBody,
        ValidationField.Email,
        ValidationField.Password,
    ]);

    if (!validationResult.success){
        throw new CustomError(ErrorName.ValidationError, validationResult.message, 400, Fault.CLIENT, true);
    }

    const { email, password } = request.body!;

    const loginResponse = await IdentityService.login(email as string, password as string);
    if (!loginResponse){
        throw new CustomError(ErrorName.InternalError, 'Login failed, Try again', 401, Fault.CLIENT, true);
    }

    return {
        success: true,
        message: 'Login, Successful!',
        data: loginResponse,
    };
};

/**
 * logoutFunc expects
 * @param 'x-access-token'
 * @returns IResponse
*/

const logoutFunc = async (request: Request): Promise<Response> => {
    const validationResult: ValidationResponse = RequestValidator.validate(request, [
        ValidationField.RequestHeaders,
        ValidationField.AccessToken,
    ]);

    if (!validationResult.success){
        throw new CustomError(ErrorName.ValidationError, validationResult.message, 400, Fault.CLIENT, true);
    }

    const accessToken = request.headers?.['x-access-token'];
    const token = accessToken?.slice(7)!;

    await IdentityService.logout(token);

    return {
        success: true,
        message: 'Logged out successfully',
    };
};

/**
 * forgetPasswordFunc expects
 * @param email
 * @returns IResponse
*/

const forgetPasswordFunc = async (request: Request): Promise<Response> => {
    const validationResult:ValidationResponse = RequestValidator.validate(request, [
        ValidationField.RequestBody,
        ValidationField.Email,
    ]);

    if (!validationResult.success){
        throw new CustomError(ErrorName.ValidationError, validationResult.message, 400, Fault.CLIENT, true);
    }

    const { email } = request.body!;

    const forgetPasswordResponse = await IdentityService.forgetPassword(email as string);
    if (!forgetPasswordResponse) {
        throw new CustomError(ErrorName.InternalError, 'Unable to reset Password', 500, Fault.SERVER, false);
    }

    return {
        success: true,
        message: 'Reset code sent successfully',
        data: forgetPasswordResponse,
    };
};

/**
 * forgetPasswordFunc expects
 * @param email
 * @param answer
 * @param password
 * @returns IResponse
*/

const confirmForgetPasswordFunc = async (request: Request): Promise<Response> => {
    const validationResult:ValidationResponse = RequestValidator.validate(request, [
        ValidationField.RequestBody,
        ValidationField.Email,
        ValidationField.Password,
        ValidationField.OTP,
    ]);

    if (!validationResult.success){
        throw new CustomError(ErrorName.ValidationError, validationResult.message, 400, Fault.CLIENT, true);
    }

    const { email, answer, password } = request.body!;

    const confirmForgetPasswordResponse = await IdentityService.confirmForgetPassword(
        email as string,
        password as string,
        answer as string,
    );
    if (!confirmForgetPasswordResponse) {
        throw new CustomError(ErrorName.InternalError, 'Password Reset Failed', 500, Fault.SERVER, false);
    }

    return {
        success: true,
        message: 'Password reset successfully',
    };
};

/**
 * forgetPasswordFunc expects
 * @param refreshToken
 * @returns IResponse
*/

const refreshSessionFunc = async (request: Request): Promise<Response> => {
    const validationResult:ValidationResponse = RequestValidator.validate(request, [
        ValidationField.RequestBody,
        ValidationField.RefreshToken,
    ]);

    if (!validationResult.success){
        throw new CustomError(ErrorName.ValidationError, validationResult.message, 400, Fault.CLIENT, true);
    }

    const { refreshToken } = request.body!;
    const sessionRefreshResponse = await IdentityService.refreshToken(refreshToken as string);
    if (!sessionRefreshResponse){
        throw new CustomError(ErrorName.InternalError, 'Session Refresh Failed', 500, Fault.SERVER, false);
    }

    return {
        success: true,
        message: 'Session Refresh Successful',
        data: sessionRefreshResponse,
    };
};

const executionFunctionMap: Record<string, (request: Request) => Promise<Response>> = {
    [ROUTES.SIGN_UP]: signupFunc,
    [ROUTES.LOGIN]: loginFunc,
    [ROUTES.LOGOUT]: logoutFunc,
    [ROUTES.FORGET_PASSWORD]: forgetPasswordFunc,
    [ROUTES.FORGET_PASSWORD_CONFIRM]: confirmForgetPasswordFunc,
    [ROUTES.SESSION_REFRESH]: refreshSessionFunc,
};

export const identityHandler = async(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const path = event.path;
        const executionFunction = executionFunctionMap[path];

        if (!executionFunction) {
            throw new CustomError(ErrorName.InternalError, `No Function Mapping Found For ${path}`, 404, Fault.CLIENT, true);
        }

        const request: Request = {
            headers: {
                ...(event.headers.Authorization || event.headers.authorization) && {
                    authorization: event.headers.Authorization || event.headers.authorization,
                },
                ...(event.headers['X-Access-Token'] || event.headers['x-access-token']) && {
                    'x-access-token': event.headers['X-Access-Token'] || event.headers['x-access-token'],
                },
            },
            body: event.body ? JSON.parse(event.body) : undefined,
        };

        const response = await executionFunction(request);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN!,
                'Access-Control-Allow-Methods': 'OPTIONS,POST',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Access-Token',
            },
            body: JSON.stringify(response),
        };

    } catch (error) {
        const errorResponse = exceptionHandlerFunction(error);
        return {
            statusCode: errorResponse.statusCode,
            headers: {
                'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN!,
                'Access-Control-Allow-Methods': 'OPTIONS,POST',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Access-Token',
            },
            body: JSON.stringify({
                success: false,
                message: errorResponse.message,
                data: {},
                error: errorResponse,
            }),
        };
    }
};
