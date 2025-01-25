// src/utils/api-client.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

interface ApiConfig {
    baseURL: string;
}

class ApiClient {
    private client: AxiosInstance;

    constructor(config: ApiConfig) {
        this.client = axios.create({
            baseURL: config.baseURL,
            headers: {
                'Content-Type': 'application/json',
            },
            validateStatus: () => true
        });
    }

    async get<T>(url: string, config?: AxiosRequestConfig) {
        const response = await this.client.get<T>(url, config);
        return response.data;
    }

    async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
        const response = await this.client.post<T>(url, data, config);
        return response.data;
    }

    async put<T>(url: string, data: unknown, config?: AxiosRequestConfig) {
        const response = await this.client.put<T>(url, data, config);
        return response.data;
    }

    async delete<T>(url: string, config?: AxiosRequestConfig) {
        const response = await this.client.delete<T>(url, config);
        return response.data;
    }
}

export const authApi = new ApiClient({ baseURL: process.env.NEXT_PUBLIC_AUTH_API_URL! });
export const userApi = new ApiClient({ baseURL: process.env.NEXT_PUBLIC_USER_API_URL! });