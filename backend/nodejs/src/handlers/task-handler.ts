import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import { SQSEvent } from 'aws-lambda';

import { Task } from '../types/task.type';

const ecsClient = new ECSClient( { region: process.env.AWS_DEFAULT_REGION! } );

export const taskHandler = async (event: SQSEvent): Promise<void> => {
    for (const record of event.Records) {
        try {
            const task: Task = JSON.parse(record.body);
            console.warn('Processing task:', task);

            const command = new RunTaskCommand({
                cluster: process.env.ECS_CLUSTER!,
                taskDefinition: process.env.PROCESSOR_TASK_DEFINITION!,
                capacityProviderStrategy: [
                    {
                        capacityProvider: 'FARGATE_SPOT',
                        weight: 1,
                    },
                ],
                networkConfiguration: {
                    awsvpcConfiguration: {
                        subnets: [process.env.SUBNET_ID!],
                        securityGroups: [process.env.SECURITY_GROUP_ID!],
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
                            ],
                        },
                    ],
                },
            });

            console.warn('Starting ECS task with params:');
            const response = await ecsClient.send(command);
            console.warn('ECS task started:', response);

        } catch (error) {
            console.error('Error processing task:', error);
            throw error;
        }
    }
};
