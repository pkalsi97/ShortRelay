import { ECSClient, RunTaskCommand, ListTasksCommand } from '@aws-sdk/client-ecs';

import { Task } from '../types/task.type';
import { exceptionHandlerFunction } from '../utils/error-handling';

export interface EcsConfig {
    region: string;
    cluster: string;
    taskDefinition: string;
    subnets: string[];
    securityGroups: string[];
    taskLimit: number;
}

let ecsConfig: EcsConfig;
let ecsClient: ECSClient;

const initialize = (config:EcsConfig): void => {
    ecsConfig = config;
    ecsClient = new ECSClient( { region: config.region } );
};

const canJobBeAssigned = async ():Promise<boolean> => {
    try {
        const listTasksCommand = new ListTasksCommand({
            cluster: ecsConfig.cluster,
            desiredStatus: 'RUNNING',
            launchType: 'FARGATE',
            maxResults: 100,
        });
        const response = await ecsClient.send(listTasksCommand);
        if (response.$metadata.httpStatusCode === 200
            && response.taskArns
            && response.taskArns.length <  ecsConfig.taskLimit
        ){
            return true;
        }

    } catch (error) {
        exceptionHandlerFunction(error);
    }

    return false;
};

const assignJob = async (tasks: Task[]): Promise<boolean> => {
    try {
        const command = new RunTaskCommand({
            cluster: ecsConfig.cluster,
            taskDefinition: ecsConfig.taskDefinition,
            capacityProviderStrategy: [
                {
                    capacityProvider: 'FARGATE_SPOT',
                    weight: 2,
                    base: 1,
                },
                {
                    capacityProvider: 'FARGATE',
                    weight: 1,
                },
            ],
            networkConfiguration: {
                awsvpcConfiguration: {
                    subnets: ecsConfig.subnets,
                    securityGroups: ecsConfig.securityGroups,
                    assignPublicIp: 'ENABLED',
                },
            },
            overrides: {
                containerOverrides: [
                    {
                        name: 'processor',
                        environment: [
                            {
                                name: 'BATCH_TASKS',
                                value: JSON.stringify(tasks.map(task => ({
                                    taskId: task.taskId,
                                    userId: task.userId,
                                    assetId: task.assetId,
                                    inputKey: task.inputKey,
                                    outputKey: task.outputKey
                                }))),
                            },
                        ],
                    },
                ],
            },
        });

        const response = await ecsClient.send(command);
        return response.$metadata.httpStatusCode === 200 ? true:false;
    } catch (error){
        exceptionHandlerFunction(error);
    }
    return false;
};

export const  WorkerService = {
    initialize,
    canJobBeAssigned,
    assignJob,
};
