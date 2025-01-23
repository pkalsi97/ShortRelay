import crypto from 'crypto';

import { CustomError, ErrorName, Fault } from '../utils/error-handling';

export interface KeyOwner {
    userId: string;
    assetId: string;
}

const getOwner = (key: string): KeyOwner => {
    const parts = key.split('/');
    if (parts.length < 2) {
        throw new CustomError(
            ErrorName.InternalError,
            'Invalid Key Format',
            400,
            Fault.CLIENT,
            false,
        );
    }

    const userId = parts[0];
    const assetId = parts[1];

    return { userId, assetId };
};

const getUploadKey = (userId:string):string => {
    const timestamp: number = Date.now();
    const uniqueId: string = crypto.randomUUID();
    const hash: string = crypto.createHash('sha256')
        .update(`${userId}-${timestamp}-${uniqueId}`)
        .digest('hex')
        .substring(0, 32);

    return `${userId}/${hash}`;
};

export const KeyService = {
    getOwner,
    getUploadKey,
};
