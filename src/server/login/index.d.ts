interface LoginResponse {
    type: string;
    username: string;
    socket: string;
    reply: number;
    lowMemory: boolean;
    reconnecting: boolean;
    staffmodlevel?: number;
    muted_until?: any | null;
    save: Uint8Array | null;
    account_id: number;
    members: boolean;
    messageCount?: number;
    remaining?: number;
}

interface LogoutResponse {
    type: string;
    username: string;
    success: boolean;
}

// custom (2026-09-27) - the answer to ::changepassword (ClientCheatHandler -> World -> LoginThread)
interface ChangePasswordResponse {
    type: string;
    username: string;
    result: 'ok' | 'wrong' | 'error';
}

export type GenericLoginThreadResponse = LoginResponse | LogoutResponse | ChangePasswordResponse;

export function isPlayerLoginResponse(response: GenericLoginThreadResponse): response is LoginResponse {
    return response.type === 'player_login';
}

export function isPlayerLogoutResponse(response: GenericLoginThreadResponse): response is LogoutResponse {
    return response.type === 'player_logout';
}

export function isChangePasswordResponse(response: GenericLoginThreadResponse): response is ChangePasswordResponse {
    return response.type === 'player_change_password';
}
