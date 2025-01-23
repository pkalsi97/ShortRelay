import {
    PutItemCommand,
    DynamoDBClient,
    UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';

import {
    AssetRecord,
    createInitialRecord,
} from '../../types/asset-record.types';

export enum ProcessingStage {
    UPLOAD = 'upload',
    VALIDATION = 'validation',
    METADATA = 'metadata',
    TRANSCODING = 'transcoding',
    COMPLETION = 'completion',
    DISTRIBUTION = 'distribution'
}
export interface DbConfig {
    table:string;
    region:string;
}

let dbConfig:DbConfig;
let dbClient:DynamoDBClient;

const initialize = (config:DbConfig): void =>{
    dbConfig = config;
    dbClient = new DynamoDBClient({region:config.region});
};

const initializeRecord = async (userId:string,assetId:string): Promise<boolean> => {
    const item: AssetRecord = createInitialRecord(userId,assetId);

    const command = new PutItemCommand({
        TableName: dbConfig.table,
        Item:item,
        ConditionExpression:'attribute_not_exists(userId) AND attribute_not_exists(assetId)',
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

const markCriticalFailure = async ( userId: string, assetId: string, value: boolean): Promise<boolean> =>{
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
