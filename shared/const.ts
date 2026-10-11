export const COOKIE_NAME = "session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias
export const UNAUTHED_ERR_MSG = "Faça login para continuar (10001)";
export const NOT_ADMIN_ERR_MSG = "Você não tem permissão para isso (10002)";
/** Cookie curto entre a senha certa e o código do 2FA. */
export const PENDING_2FA_COOKIE = "session_2fa";
export const PENDING_2FA_TTL_MS = 1000 * 60 * 5; // 5 minutos para digitar o código
