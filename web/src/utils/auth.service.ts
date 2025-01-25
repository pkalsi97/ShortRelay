interface AuthTokens {
    IdToken: string;
    AccessToken: string;
    ExpiresIn: number;
    TokenType: string;
}

export const authService = {
    setTokens(tokens: AuthTokens) {
        localStorage.setItem('accessToken', tokens.AccessToken);
        localStorage.setItem('idToken', tokens.IdToken);
        localStorage.setItem('tokenExpiry', (Date.now() + tokens.ExpiresIn * 1000).toString());
        localStorage.setItem('tokenType', tokens.TokenType);
    },

    clearTokens() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('idToken');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('tokenType');
    },

    getAccessToken() {
        return localStorage.getItem('accessToken');
    },

    getIdToken() {
        return localStorage.getItem('idToken');
    },

    isAuthenticated() {
        const expiry = localStorage.getItem('tokenExpiry');
        if (!expiry) return false;
        return Date.now() < parseInt(expiry);
    },

    isTokenExpiringSoon() {
        const expiry = localStorage.getItem('tokenExpiry');
        if (!expiry) return true;
        return Date.now() > (parseInt(expiry) - 5 * 60 * 1000);
    }
};