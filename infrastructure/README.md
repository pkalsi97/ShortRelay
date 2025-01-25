# ShortRelay

A serverless video processing pipeline that handles short-form video uploads, processing, and delivery.

## Architecture

The application is built using AWS Serverless services:

- **Authentication**: Amazon Cognito for user management
- **API Layer**: API Gateway with Lambda functions
- **Storage**:
  - Transport Bucket: Temporary storage for uploads
  - Content Bucket: Processed video storage
  - DynamoDB: Metadata and state management

## Infrastructure
The infrastructure is defined using AWS SAM/CloudFormation:

```bash
infrastructure/
    └── application.yml
```

### Key Components

- Identity Management API (`/v1/auth/*`)
- Upload Management API (`/v1/user/*`)
- Secure storage with encryption
- Event-driven processing pipeline

## Deployment

Prerequisites:
- AWS CLI
- Node.js 18+
- AWS SAM CLI

## Parameters

- `AppId`: Application identifier
- `Environment`: Deployment environment (Development/Staging/Production)
- `UploadSizeLimit`: Maximum upload size
- `UploadTimeLimit`: Upload time limit
- `TransportExpiryDays`: Temporary storage retention period
- `AllowedOrigin`: Allowed Origin
- `AesKeyUtil`: Aes key for encryption
