import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { AuthConfig, IdentityService } from '../services/auth/identity-service';
import { MetadataService } from '../services/data/metadata-service';
import { DbConfig } from '../types/db.types';
import { Request, Response } from '../types/request-response.types';
import { Fault, CustomError, ErrorName, exceptionHandlerFunction } from '../utils/error-handling';
import { ValidationField, ValidationResponse, RequestValidator } from '../utils/request-validator';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN!,
    'Access-Control-Allow-Methods': 'OPTIONS,POST',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Access-Token',
} as const;

// Initialize
const authConfig: AuthConfig = {
    userPoolId: process.env.USER_POOL_ID!,
    clientId: process.env.CLIENT_ID!,
    region: process.env.AWS_DEFAULT_REGION!,
};

const dbConfig: DbConfig = {
    table: process.env.METADATASTORAGE_TABLE_NAME!,
    region: process.env.AWS_DEFAULT_REGION!,
};

MetadataService.initialize(dbConfig);
IdentityService.initialize(authConfig);

const getAllAssets = async(request:Request): Promise<Response> => {
    const validationResult:ValidationResponse = RequestValidator.validate(request, [
        ValidationField.RequestHeaders,
        ValidationField.AccessToken,
    ]);

    if (!validationResult.success){
        throw new CustomError(ErrorName.ValidationError, validationResult.message, 400, Fault.CLIENT, true);
    }

    const token = request.headers?.['x-access-token'];
    const accessToken = token?.slice(7)!;
    const userId = await IdentityService.getUser(accessToken);

    const records = await MetadataService.getAllAssets(userId);

    return {
        success: true,
        message: 'All Assets!',
        data: records,
    };
};

const getAsset = async(request:Request): Promise<Response> => {
    const validationResult:ValidationResponse = RequestValidator.validate(request, [
        ValidationField.RequestHeaders,
        ValidationField.AccessToken,
    ]);
    if (!validationResult.success){
        throw new CustomError(ErrorName.ValidationError, validationResult.message, 400, Fault.CLIENT, true);
    }

    const assetId = request.parameters?.assetId;
    if (!assetId) {
        throw new CustomError(
            ErrorName.ValidationError, 'Asset ID is required', 400, Fault.CLIENT, true);
    }

    const token = request.headers?.['x-access-token'];
    const accessToken = token?.slice(7)!;
    const userId = await IdentityService.getUser(accessToken);

    const record = await MetadataService.getAsset(userId, assetId);

    return {
        success: true,
        message: 'particular Asset',
        data: record,
    };
};

interface RoutePattern {
    pattern: RegExp;
    handler: (request: Request) => Promise<Response>;
}

const ROUTES: Record<string, RoutePattern> = {
    ASSETS_ALL: {
        pattern: /^\/v1\/user\/assets\/all$/,
        handler: getAllAssets,
    },
    ASSET: {
        pattern: /^\/v1\/user\/assets\/[^/]+$/,
        handler: getAsset,
    },
} as const;

const matchRoute = (path: string): RoutePattern | undefined => {
    return Object.values(ROUTES).find(route =>
        route.pattern.test(path),
    );
};

export const contentRequestHandler = async (event: APIGatewayProxyEvent):Promise<APIGatewayProxyResult> => {
    try {
        const path = event.path;
        const match = matchRoute(path);

        if (!match) {
            throw new CustomError(ErrorName.InternalError, `No Function Mapping Found For ${path}`, 404, Fault.CLIENT, true);
        }

        const request : Request = {
            headers: {
                ...(event.headers.Authorization || event.headers.authorization) && {
                    authorization: event.headers.Authorization || event.headers.authorization,
                },
                ...(event.headers['X-Access-Token'] || event.headers['x-access-token']) && {
                    'x-access-token': event.headers['X-Access-Token'] || event.headers['x-access-token'],
                },
            },
            body: event.body ? JSON.parse(event.body) : undefined,
            parameters: {
                ...event.pathParameters,
                ...event.queryStringParameters,
            },
        };

        const response = await match.handler(request);

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify(response),
        };

    } catch (error){
        const errorResponse = exceptionHandlerFunction(error);
        return {
            statusCode: errorResponse.statusCode,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: false,
                message: errorResponse.message,
                data: {},
                error: errorResponse,
            }),
        };
    }
};

