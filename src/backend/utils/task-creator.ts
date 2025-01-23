import crypto from 'crypto';

import { Task,Location,TaskType, WorkerType } from '../types/task.type';

const createTask = (
    userId: string,
    assetId: string,
    input: Location,
    output: Location,
    type: TaskType,
    worker: WorkerType,
): Task =>{
    return {
        taskId: `${type}-${crypto.randomUUID()}`,
        userId,
        assetId,
        input,
        output,
        type,
        worker,
        createdAt: new Date().toISOString(),
    };
};

export const TaskService ={
    createTask,
};

