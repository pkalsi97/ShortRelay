import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import { SQSEvent } from 'aws-lambda';

import { Task } from '../types/task.type';

const ecsClient = new ECSClient( { region: process.env.AWS_DEFAULT_REGION! } );

const config = {
    region: process.env.AWS_DEFAULT_REGION!,
    cluster: process.env.ECS_CLUSTER!,
    taskDefinition: process.env.PROCESSOR_TASK_DEFINITION!,
    subnets: process.env.SUBNET_IDS!.split(','),
    securityGroups: [process.env.SECURITY_GROUP_ID!],
};

export const taskHandler = async (event: SQSEvent): Promise<void> => {
    for (const record of event.Records) {
        try {
            const task: Task = JSON.parse(record.body);

            const command = new RunTaskCommand({
                cluster: config.cluster,
                taskDefinition: `${config.taskDefinition}`,
                capacityProviderStrategy: [
                    {
                        capacityProvider: 'FARGATE',
                        weight: 1,
                    },
                ],
                networkConfiguration: {
                    awsvpcConfiguration: {
                        subnets: config.subnets,
                        securityGroups: config.securityGroups,
                        assignPublicIp: 'ENABLED',
                    },
                },
                overrides: {
                    containerOverrides: [
                        {
                            name: 'processor',
                            environment: [
                                {
                                    name: 'TASK_ID',
                                    value: task.taskId,
                                },
                                {
                                    name: 'USER_ID',
                                    value: task.userId,
                                },
                                {
                                    name: 'ASSET_ID',
                                    value: task.assetId,
                                },
                                {

                                },
                            ],
                        },
                    ],
                },
            });

            const response = await ecsClient.send(command);

        } catch (error) {
            console.error('Error processing task:', error);
            throw error;
        }
    }
};

// Multiple AZs
// Multiple subnets
// Both FARGATE and FARGATE_SPOT providers
// instance limit 
// dql
