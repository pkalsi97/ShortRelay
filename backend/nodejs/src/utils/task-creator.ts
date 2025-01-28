import crypto from 'crypto';

import { Task, TaskType, WorkerType } from '../types/task.type';

const createTask = (
    userId: string,
    assetId: string,
    type: TaskType,
    inputKey: string,
    outputKey: string,
    worker: WorkerType,
): Task => {
    return {
        taskId: `${type}-${crypto.randomUUID()}`,
        userId,
        assetId,
        inputKey,
        outputKey,
        type,
        worker,
        createdAt: new Date().toISOString(),
    };
};

export const TaskService ={
    createTask,
};

