import { PutItemCommand, DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

import { AssetRecord, createInitialRecord } from '../../types/asset-record.types';
import { DbConfig } from '../../types/db.types';

export enum MetadataPath {
    BASIC = 'validation.basic',
    STREAM = 'validation.stream',
    TECHNICAL = 'metadata.technical',
    QUALITY = 'metadata.quality',
}

export enum ProcessingStage {
    UPLOAD = 'upload',
    VALIDATION = 'validation',
    ACCEPTED = 'accepted',
    REJECTED = 'rejected',
    METADATA = 'metadata',
    TRANSCODINGTASK = 'transcodingTask',
    WRITETOTEMP = 'writeToTemp',
    INITIALIZEPROCESSOR = 'initializeProcessor',
    DOWNLOAD = 'download',
    THUMBNAIL = 'generateThumbnail',
    MP4FILES = 'MP4Files',
    HLS = 'generateHLSPlaylists',
    IFRAME = 'generateIframePlaylists',
    UPLOADT = 'uploadTranscodedFootage',
    COMPLETION = 'completion',
    DISTRIBUTION = 'distribution'
}

let dbConfig:DbConfig;
let dbClient:DynamoDBClient;

const initialize = (config:DbConfig): void => {
    dbConfig = config;
    dbClient = new DynamoDBClient({ region: config.region });
};

const initializeRecord = async (userId:string, assetId:string): Promise<boolean> => {
    const item: AssetRecord = createInitialRecord(userId, assetId);

    const command = new PutItemCommand({
        TableName: dbConfig.table,
        Item: item,
        ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(assetId)',
    });

    const response = await dbClient.send(command);
    return response.$metadata.httpStatusCode === 200;
};

const updateProgress = async (
    userId: string,
    assetId: string,
    stage: ProcessingStage,
    value: boolean,
): Promise<boolean> => {
    const command = new UpdateItemCommand({
        TableName: dbConfig.table,
        Key: {
            userId: { S: userId },
            assetId: { S: assetId },
        },
        UpdateExpression: 'SET progress.#stage = :value, progress.updatedAt = :time',
        ExpressionAttributeNames: {
            '#stage': stage,
        },
        ExpressionAttributeValues: {
            ':value': { BOOL: value },
            ':time': { S: new Date().toISOString() },
        },
    });

    const response = await dbClient.send(command);
    return response.$metadata.httpStatusCode === 200;
};

const markCriticalFailure = async ( userId: string, assetId: string, value: boolean): Promise<boolean> => {
    const command = new UpdateItemCommand({
        TableName: dbConfig.table,
        Key: {
            userId: { S: userId },
            assetId: { S: assetId },
        },
        UpdateExpression: 'SET progress.hasCriticalFailure = :value, progress.updatedAt = :time',
        ExpressionAttributeValues: {
            ':value': { BOOL: value },
            ':time': { S: new Date().toISOString() },
        },
    });
    const response = await dbClient.send(command);
    return response.$metadata.httpStatusCode === 200;
};
/* eslint-disable @typescript-eslint/no-explicit-any */

interface UpdateCommandParams {
    UpdateExpression: string;
    ExpressionAttributeNames: Record<string, string>;
    ExpressionAttributeValues: Record<string, any>;
}

const UPDATE_PATHS: Record<MetadataPath, string[]> = {
    [MetadataPath.BASIC]: ['metadata', 'validation', 'basic'],
    [MetadataPath.STREAM]: ['metadata', 'validation', 'stream'],
    [MetadataPath.TECHNICAL]: ['metadata', 'technical'],
    [MetadataPath.QUALITY]: ['metadata', 'quality'],
};

const convertToMapAttribute = (data: any): Record<string, any> => {
    const result: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
        if (value === null || value === undefined || value === 'N/A') {
            result[key] = { NULL: true };
        } else if (typeof value === 'boolean') {
            result[key] = { BOOL: value };
        } else if (typeof value === 'number') {
            result[key] = { N: value.toString() };
        } else if (typeof value === 'object') {
            result[key] = { M: convertToMapAttribute(value) };
        } else {
            result[key] = { S: value.toString() };
        }
    });
    return result;
};

const createUpdateCommand = (path: MetadataPath, data: any): UpdateCommandParams => {
    const pathParts = UPDATE_PATHS[path];
    const attributeNames = pathParts.reduce((acc, part) => ({
        ...acc,
        [`#${part}`]: part,
    }), {});

    return {
        UpdateExpression: `SET ${pathParts.map(p => `#${p}`).join('.')} = :data`,
        ExpressionAttributeNames: attributeNames,
        ExpressionAttributeValues: {
            ':data': { M: convertToMapAttribute(data) },
        },
    };
};

const updateMetadata = async (
    userId: string, assetId: string, path: MetadataPath, data: any ): Promise<boolean> => {
    const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } = createUpdateCommand(path, data);

    const command = new UpdateItemCommand({
        TableName: dbConfig.table,
        Key: {
            userId: { S: userId },
            assetId: { S: assetId },
        },
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
    });

    const response = await dbClient.send(command);
    return response.$metadata.httpStatusCode === 200;
};

/* eslint-enable @typescript-eslint/no-explicit-any */
export const MetadataService = {
    initialize,
    initializeRecord,
    updateProgress,
    markCriticalFailure,
    updateMetadata,
};
