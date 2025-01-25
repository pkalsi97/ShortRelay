import { GetItemCommand, PutItemCommand, DynamoDBClient, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';

import { DbConfig } from '../../types/db.types';

export enum CacheFieldType {
    RefreshToken = 'refreshToken',
}

let dbConfig:DbConfig;
let dbClient:DynamoDBClient;

const initialize = (config:DbConfig): void => {
    dbConfig = config;
    dbClient = new DynamoDBClient({ region: config.region });
};

const putAuthItem = async (userId:string, token:string): Promise<boolean> => {

    const command = new PutItemCommand({
        TableName: dbConfig.table,
        Item: { userId: { S: userId }, refreshToken: { S: token } },
        ConditionExpression: 'attribute_not_exists(userId)',
    });

    const response = await dbClient.send(command);
    return response.$metadata.httpStatusCode! < 400;
};

const getAuthItem = async (userId: string, field: CacheFieldType): Promise<string | null> => {
    const command = new GetItemCommand({
        TableName: dbConfig.table,
        Key: { userId: { S: userId } },
        ProjectionExpression: '#field',
        ExpressionAttributeNames: {
            '#field': field,
        },
    });

    const response = await dbClient.send(command);

    if (response && response.Item && response.Item[field]){
        return response.Item[field].S!;
    }

    return null;
};

const updateAuthItem = async(userId: string, value: string, field: CacheFieldType):Promise<boolean> => {

    const updateExpression = `SET ${field} = :val`;
    const expressionAttributeValues = { ':val': { S: value } };

    const command = new UpdateItemCommand({
        TableName: dbConfig.table,
        Key: { userId: { S: userId } },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    });

    const response = await dbClient.send(command);
    return response.$metadata.httpStatusCode! < 400;
};

const deleteCacheItemFunc = async(userId: string):Promise<boolean> => {
    const command = new DeleteItemCommand({
        TableName: dbConfig.table,
        Key: { userId: { S: userId } },
        ReturnValues: 'ALL_OLD',
    });

    const response = await dbClient.send(command);
    return response.$metadata.httpStatusCode! < 400;
};

export const AuthCacheService = {
    initialize,
    putAuthItem,
    updateAuthItem,
    getAuthItem,
    deleteCacheItemFunc,
};
