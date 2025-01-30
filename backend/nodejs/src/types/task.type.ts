export enum TaskType {
    TRANSCODE = 'TRANSCODE',
    VALIDATION = 'VALIDATION'
}

export enum WorkerType {
    PROCESSOR = 'PROCESSOR',
    VALIDATOR = 'VALIDATOR'
}

export interface Location {
    Bucket?: string;
    Key?: string;
}

export interface Task {
    taskId: string;
    userId: string;
    assetId: string;
    inputKey: string;
    outputKey: string;
    type: TaskType;
    worker: WorkerType;
    createdAt: string;
}
