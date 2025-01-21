import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { AuthConfig, IdentityService } from '../services/auth/identity-service';
import { UploadConfig, UploadService } from '../services/data/upload-service';
import { Request,Response } from '../types/request-response.types';
import {Fault,CustomError,ErrorName,exceptionHandlerFunction} from '../utils/error-handling';
import {  KeyService } from '../utils/key-service';
import { ValidationField, ValidationResponse, RequestValidator } from '../utils/request-validator';

const ROUTES = {
    UPLOAD_REQUEST: '/v1/user/upload-request',
} as const;

// Initialize
const authConfig: AuthConfig = {
    userPoolId: process.env.USER_POOL_ID!,
    clientId: process.env.CLIENT_ID!,
    region: process.env.AWS_DEFAULT_REGION!,
};

const uploadConfig: UploadConfig = {
    region: process.env.AWS_DEFAULT_REGION!,
    bucket: process.env.TRANSPORTSTORAGE_BUCKET_NAME!,
    uploadSizeLimit: parseInt(process.env.UPLOAD_SIZE_LIMIT!,10),
    uploadTimeLimit: parseInt(process.env.UPLOAD_TIME_LIMIT!,10),
};

IdentityService.initialize(authConfig);
UploadService.initialize(uploadConfig);

/**
 * Handles upload request generation
 * @param request - Validated request object
 * @returns Response with presigned upload URL
 * @throws CustomError if validation fails or upload service is down
 */

const uploadRequestFunc = async (request:Request):Promise<Response> => {
    const validationResult:ValidationResponse = RequestValidator.validate(request,[
        ValidationField.RequestHeaders,
        ValidationField.AccessToken,
    ]);

    if (!validationResult.success){
        throw new CustomError (ErrorName.ValidationError,validationResult.message,400,Fault.CLIENT,true);
    }

    const token = request.headers?.['x-access-token'];
    const accessToken = token?.slice(7)!;
    const userId = await IdentityService.getUser(accessToken);
    const key = KeyService.getUploadKey(userId);

    const uploadServiceResponse = await UploadService.generatePreSignedPost(userId,key);
    if (!uploadServiceResponse){
        throw new CustomError(ErrorName.UploadError,'Upload Service is down!',503,Fault.SERVER,true);
    }

    return {
        success:true,
        message: 'Upload url successfully generated!',
        data:uploadServiceResponse,
    };
};

const executionFunctionMap: Record<string, (request: Request) => Promise<Response>> = {
    [ROUTES.UPLOAD_REQUEST]: uploadRequestFunc,
};

export const uploadHandler = async(event:APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>{
    try{
        const path = event.path;
        const executionFunction = executionFunctionMap[path];
        if (!executionFunction) {
            throw new CustomError(ErrorName.InternalError,`No Function Mapping Found For ${path}`,404,Fault.CLIENT,true);
        }

        const request : Request = {
            headers:{
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
            statusCode:200,
            body: JSON.stringify(response),
        };

    } catch (error){
        const errorResponse = exceptionHandlerFunction(error);
        return {
            statusCode:errorResponse.statusCode,
            body:JSON.stringify({
                success:false,
                message:errorResponse.message,
                body:{},
                error:errorResponse,
            }),
        };
    }
};
