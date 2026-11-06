interface LoginResponse {
    type: string;
    username: string;
    socket: string;
    reply: number;
    lowMemory: boolean;
    reconnecting: boolean;
    staffmodlevel?: number;
    // custom (2026-11-06) - the Veteran rank. Optional like staffmodlevel, and read as 0 when
    // a login server older than the column does not send it.
    veteran?: number;
    muted_until?: any | null;
    save: Uint8Array | null;
    account_id: number;
    members: boolean;
    // custom (2026-11-02) - whether the login block carried the saved-login fields at all, which
    // is the client's revision and not a choice. Logged, never acted on.
    sendsToken?: boolean;
    // custom (2026-11-02) - a freshly issued saved-login token, when the client asked for one and
    // the password was right. Only ever set on the login that minted it; World hands it straight
    // to the player, and nothing reads it back from here.
    token?: string;
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

// custom (2026-11-02) - the answer to ::forgetlogins. `count` is how many saved logins there were
// to cancel, so the player is told whether anything happened.
interface ForgetLoginsResponse {
    type: string;
    username: string;
    count: number;
    ok: boolean;
}

export type GenericLoginThreadResponse = LoginResponse | LogoutResponse | ChangePasswordResponse | ForgetLoginsResponse;

export function isPlayerLoginResponse(response: GenericLoginThreadResponse): response is LoginResponse {
    return response.type === 'player_login';
}

export function isPlayerLogoutResponse(response: GenericLoginThreadResponse): response is LogoutResponse {
    return response.type === 'player_logout';
}

export function isChangePasswordResponse(response: GenericLoginThreadResponse): response is ChangePasswordResponse {
    return response.type === 'player_change_password';
}

export function isForgetLoginsResponse(response: GenericLoginThreadResponse): response is ForgetLoginsResponse {
    return response.type === 'player_forget_logins';
}
