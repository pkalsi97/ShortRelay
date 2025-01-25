import { AttributeValue } from '@aws-sdk/client-dynamodb';

export interface AssetProgress {
    M: Record<string, AttributeValue>;
}

export interface AssetRecord extends Record<string, AttributeValue> {
    userId: { S: string };
    assetId: { S: string};
    createdAt: { S: string};
    progress: AssetProgress;
}

export const createInitialRecord = (userId: string, assetId: string): AssetRecord => ({
    userId: { S: userId },
    assetId: { S: assetId },
    createdAt: { S: new Date().toISOString() },
    progress: {
        M: {
            upload: { BOOL: false },
            validation: { BOOL: false },
            metadata: { BOOL: false },
            transcoding: { BOOL: false },
            completion: { BOOL: false },
            distribution: { BOOL: false },
            updatedAt: { S: new Date().toISOString() },
            hasCriticalFailure: { BOOL: false },
        },
    },
});
