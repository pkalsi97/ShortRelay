import { PutItemCommand, DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

import { AssetRecord, createInitialRecord } from '../../types/asset-record.types';
import { DbConfig } from '../../types/db.types';

export enum ProcessingStage {
    UPLOAD = 'upload',
    BASIC_VALIDATION = 'basicValidation',
    STREAM_VALIDATION = 'streamValidation',
    ACCEPTED = 'accepted',
    TECHNICAL_METADATA = 'technicalMetadata',
    QUALITY_METADATA = 'qualityMetadata',
    TRANSCODING_TASK = 'transcodingTask',
    WRITE_TO_TEMP = 'writeToTemp',
    INITIALIZE_PROCESSOR = 'initializeProcessor',
    DOWNLOAD = 'download',
    THUMBNAIL = 'generateThumbnail',
    MP4_FILES = 'MP4Files',
    HLS = 'generateHLSPlaylists',
    IFRAME = 'generateIframePlaylists',
    UPLOAD_T = 'uploadTranscodedFootage',
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

export const MetadataService = {
    initialize,
    initializeRecord,
    updateProgress,
    markCriticalFailure,
};
