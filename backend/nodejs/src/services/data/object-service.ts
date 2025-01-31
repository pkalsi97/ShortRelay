import * as fs from 'fs';

import { S3Client, GetObjectCommand, DeleteObjectCommand, GetObjectCommandOutput, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

export interface ObjectServiceConfig {
    bucket:string;
    region:string;
}

let objectServiceConfig:ObjectServiceConfig;
let s3Client:S3Client;

const initialize = (config:ObjectServiceConfig): void => {
    objectServiceConfig = config;
    s3Client = new S3Client({ region: objectServiceConfig.region });
};

const getObject = async (key:string):Promise<GetObjectCommandOutput['Body']> => {
    const command = new GetObjectCommand({
        Bucket: objectServiceConfig.bucket,
        Key: key,
    });
    return (await s3Client.send(command)).Body;
};

const uploadObject = async (object:fs.ReadStream, key:string):Promise<boolean> => {
    const upload = new Upload({
        client: s3Client,
        params: {
            Bucket: objectServiceConfig.bucket,
            Key: key,
            Body: object,
        },
    });

    const result = await upload.done();
    return result.$metadata.httpStatusCode === 200;
};

const deleteObject = async (key:string):Promise<boolean> => {
    const command = new DeleteObjectCommand({
        Bucket: objectServiceConfig.bucket,
        Key: key,
    });

    const response = await s3Client.send(command);

    return response.$metadata.httpStatusCode === 204;
};

const getFileCount = async (prefix:string): Promise<number> =>{
    const command = new ListObjectsV2Command({
        Bucket: objectServiceConfig.bucket,
        Prefix: prefix
    });

    let fileCount = 0;
    let response;

    do {
        response = await s3Client.send(command);
        fileCount += response.Contents?.length || 0;
        command.input.ContinuationToken = response.NextContinuationToken;
    } while (response.IsTruncated);

    return fileCount;
}

export const ObjectService = {
    initialize,
    getObject,
    uploadObject,
    deleteObject,
    getFileCount,
};