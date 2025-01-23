import crypto from 'crypto';
import * as fs from 'fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as path from 'path';

import type { GetObjectCommandOutput } from '@aws-sdk/client-s3';

const writeFile = async (basePath:string,object: GetObjectCommandOutput['Body']): Promise<string> => {
    const fileName = crypto.randomUUID();
    const filePath = path.join(basePath,fileName);

    const writeStream = fs.createWriteStream(filePath);
    const bytes = await object!.transformToByteArray();
    const readable = Readable.from(Buffer.from(bytes), { objectMode: false });

    await pipeline(readable,writeStream);
    return filePath;
};

const getFile = async (path:string): Promise<fs.ReadStream> => {
    await fs.promises.access(path, fs.constants.R_OK);
    return fs.createReadStream(path);
};

const cleanUp = async (path:string): Promise<boolean> => {
    try {
        await fs.promises.access(path, fs.constants.F_OK);
        await fs.promises.unlink(path);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return true;
        }
        return false;
    }
};

export const FileManager = {
    writeFile,
    getFile,
    cleanUp,
};
