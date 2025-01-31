import { GetItemCommand, PutItemCommand, DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

import { AssetRecord, StageProgressUpdate, createInitialRecord } from '../../types/asset-record.types';
import { DbConfig } from '../../types/db.types';
import { KeyOwner } from '../../utils/key-service';

export enum MetadataPath {
    BASIC = 'validation.basic',
    STREAM = 'validation.stream',
    TECHNICAL = 'metadata.technical',
    QUALITY = 'metadata.quality',
}

export enum Progress {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    HOLD = 'HOLD',
}

export enum ProcessingStage {
    Upload = 'upload',
    Validation = 'validation',
    Metadata = 'metadata',
    Accepted = 'accepted',
    Download = 'download',
    WriteToStorage = 'writeToStorage',
    InitializeProcessor = 'initializeProcessor',
    GenerateThumbnail = 'generateThumbnail',
    GenerateMP4Files = 'generateMP4Files',
    GenerateHLSPlaylists = 'generateHLSPlaylists',
    UploadTranscodedFootage = 'uploadTranscodedFootage',
    PostProcessingValidation = 'postProcessingValidation',
    Completion = 'completion',
    Distribution = 'distribution'
}

let dbConfig:DbConfig;
let dbClient:DynamoDBClient;

const initialize = (config:DbConfig): void => {
    dbConfig = config;
    dbClient = new DynamoDBClient({ region: config.region });
};

const initializeRecord = async (owner: KeyOwner): Promise<boolean> => {
    const userId = owner.userId;
    const assetId = owner.assetId;
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
    owner: KeyOwner,
    currentStage: string,
    nextStage: string,
    progressData: StageProgressUpdate,
): Promise<boolean> => {
    const userId = owner.userId;
    const assetId = owner.assetId;
    const command = new UpdateItemCommand({
        TableName: dbConfig.table,
        Key: {
            userId: { S: userId },
            assetId: { S: assetId },
        },
        UpdateExpression: `
            SET progress.#currentStage.#status = :status,
                progress.#currentStage.#startTime = :startTime,
                progress.#currentStage.#endTime = :endTime,
                progress.#currentStage.#error = :error,
                stage = :nextStage,
                updatedAt = :updateTime
        `,
        ExpressionAttributeNames: {
            '#currentStage': currentStage,
            '#status': 'status',
            '#startTime': 'startTime',
            '#endTime': 'endTime',
            '#error': 'error',
        },
        ExpressionAttributeValues: {
            ':status': { S: progressData.status },
            ':startTime': { S: progressData.startTime },
            ':endTime': { S: new Date().toISOString() },
            ':error': { S: progressData.error },
            ':nextStage': { S: nextStage },
            ':updateTime': { S: new Date().toISOString() },
        },
    });

    const response = await dbClient.send(command);
    return response.$metadata.httpStatusCode === 200;
};

const markCriticalFailure = async ( owner: KeyOwner, value: boolean): Promise<boolean> => {
    const userId = owner.userId;
    const assetId = owner.assetId;
    const command = new UpdateItemCommand({
        TableName: dbConfig.table,
        Key: {
            userId: { S: userId },
            assetId: { S: assetId },
        },
        UpdateExpression: 'SET hasCriticalFailure = :value, updatedAt = :time',
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

const updateMetadata = async ( owner: KeyOwner, path: MetadataPath, data: any ): Promise<boolean> => {
    const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } = createUpdateCommand(path, data);
    const userId = owner.userId;
    const assetId = owner.assetId;

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

const getCreatedTime = async ( owner: KeyOwner ): Promise<string> => {
    const userId = owner.userId;
    const assetId = owner.assetId;

    const command = new GetItemCommand({
        TableName: dbConfig.table,
        Key: {
            userId: { S: userId },
            assetId: { S: assetId },
        },
        ProjectionExpression: 'createdAt',
    });

    const response = await dbClient.send(command);
    return response.Item?.createdAt?.S ?? new Date().toISOString();
};

const updateProgressField = async (
    owner: KeyOwner,
    stage: string,
    field: 'status' | 'startTime' | 'endTime' | 'error',
    value: string,
): Promise<boolean> => {
    const command = new UpdateItemCommand({
        TableName: dbConfig.table,
        Key: {
            userId: { S: owner.userId },
            assetId: { S: owner.assetId },
        },
        UpdateExpression: `
            SET progress.#stage.#field = :value,
                updatedAt = :updateTime
        `,
        ExpressionAttributeNames: {
            '#stage': stage,
            '#field': field,
        },
        ExpressionAttributeValues: {
            ':value': { S: value },
            ':updateTime': { S: new Date().toISOString() },
        },
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
    getCreatedTime,
    updateProgressField,
};
