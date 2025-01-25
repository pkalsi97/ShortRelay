import crypto from 'crypto';

export interface EncryptionConfig {
    key: string;
}

let encryptionConfig:EncryptionConfig;

const initialize = (config:EncryptionConfig): void => {
    encryptionConfig = config;
};

const encrypt = (text: string): string => {
    const keyBuffer = Buffer.from(encryptionConfig.key, 'utf-8');

    const cipher = crypto.createCipheriv('aes-256-ecb', keyBuffer, null);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
};

const decrypt = (encryptedText: string): string => {
    const keyBuffer = Buffer.from(encryptionConfig.key, 'utf-8');

    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuffer, null);
    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};

export const EncryptionService = {
    initialize,
    encrypt,
    decrypt,
};
