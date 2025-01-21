import {
    CognitoIdentityProviderClient,
    SignUpCommand,
    AdminUpdateUserAttributesCommand,
    InitiateAuthCommand,
    AdminConfirmSignUpCommand,
    ForgotPasswordCommand,
    ConfirmForgotPasswordCommand,
    GlobalSignOutCommand,
    InitiateAuthCommandOutput,
    ForgotPasswordCommandOutput,
    AdminDeleteUserCommand,
    GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

interface AuthConfig {
    userPoolId: string;
    clientId: string;
    region: string;
}

let cognitoClient:CognitoIdentityProviderClient;
let cognitoConfig:AuthConfig;

const initialize = (config:AuthConfig): void => {
    cognitoConfig = config;
    cognitoClient = new CognitoIdentityProviderClient({region:config.region});
};

const createUser = async (email:string,password:string):Promise<boolean> =>{
    const createUserCommand = new SignUpCommand({
        ClientId: cognitoConfig.clientId,
        Username: email,
        Password: password,
        UserAttributes:[
            {
                Name:'email',
                Value:email,
            },
        ],
    });

    const createUserResponse = await cognitoClient.send(createUserCommand);
    if(!createUserResponse.UserSub) {
        return false;
    }

    const adminUpdateUserAttributeResponse = await adminUpdateUserAttribute(email);
    if(!adminUpdateUserAttributeResponse){
        await adminDeleteUser(email);
        return false;
    }

    const confirmUserResponse = await adminConfirmUser(email);
    if(!confirmUserResponse){
        await adminDeleteUser(email);
        return false;
    }

    return true;
};

const adminDeleteUser = async (email:string):Promise<boolean> => {
    const command = new AdminDeleteUserCommand({
        UserPoolId: cognitoConfig.userPoolId,
        Username: email,
    });

    const response = await cognitoClient.send(command);
    return response.$metadata.httpStatusCode===200;
};

const adminUpdateUserAttribute = async (email:string):Promise<boolean> => {
    const command = new AdminUpdateUserAttributesCommand({
        UserPoolId: cognitoConfig.userPoolId,
        Username: email,
        UserAttributes: [
            {
                Name: 'email_verified',
                Value: 'true',
            },
        ],
    });

    const response = await cognitoClient.send(command);
    return response.$metadata.httpStatusCode===200;

};

const adminConfirmUser = async (email:string):Promise<boolean> => {
    const command = new AdminConfirmSignUpCommand({
        UserPoolId: cognitoConfig.userPoolId,
        Username: email,
    });
    const response = await cognitoClient.send(command);
    return response.$metadata.httpStatusCode===200;
};

const login = async (email:string,password:string):Promise<InitiateAuthCommandOutput['AuthenticationResult']> => {
    const command = new InitiateAuthCommand({
        ClientId: cognitoConfig.clientId,
        AuthFlow:'USER_PASSWORD_AUTH',
        AuthParameters:{
            USERNAME:email,
            PASSWORD:password,
        },
    });

    const response = await cognitoClient.send(command);
    return response.AuthenticationResult;
};

const forgetPassword = async (email:string): Promise<ForgotPasswordCommandOutput['CodeDeliveryDetails']> => {
    const command = new ForgotPasswordCommand({
        ClientId: cognitoConfig.clientId,
        Username: email,
    });

    const response = await cognitoClient.send(command);
    return response.CodeDeliveryDetails;
};

const confirmForgetPassword = async (email:string,password:string,answer:string):Promise<boolean> => {
    const command = new ConfirmForgotPasswordCommand({
        ClientId: cognitoConfig.clientId,
        Username:email,
        ConfirmationCode:answer,
        Password:password,
    });
    const response = await cognitoClient.send(command);
    if(response.$metadata.httpStatusCode!==200) {
        return false;
    }
    return true;
};

const logout = async (accessToken:string):Promise<boolean> => {
    const command = new GlobalSignOutCommand({
        AccessToken:accessToken,
    });
    const response = await cognitoClient.send(command);
    return response.$metadata.httpStatusCode === 200;
};

const refreshToken = async (refreshToken:string):Promise<InitiateAuthCommandOutput['AuthenticationResult']> => {
    const command = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: cognitoConfig.clientId,
        AuthParameters:{
            REFRESH_TOKEN: refreshToken,
        },
    });

    const response = await cognitoClient.send(command);
    return response.AuthenticationResult;
};

const getUser = async (accessToken:string):Promise<string> => {
    const command = new GetUserCommand({
        AccessToken:accessToken,
    });

    const response = await cognitoClient.send(command);
    const userId = response.UserAttributes!.find(att => att.Name === 'sub')!.Value!;
    return userId;
};

export const IdentityService = {
    initialize,
    createUser,
    login,
    forgetPassword,
    confirmForgetPassword,
    logout,
    refreshToken,
    getUser,
};
