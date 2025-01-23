import {
    PutItemCommand,
    DynamoDBClient,
    UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';

export interface DbConfig {
    table:string;
    region:string;
}
let dbConfig:DbConfig;
let dbClient:DynamoDBClient;

const initialize = (config:DbConfig): void =>{
    dbConfig = config;
    dbClient = new DynamoDBClient();
};

export const MetadataService = {
    initialize,
};
