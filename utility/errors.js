/*!
 * Copyright 2023 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

export const ErrorCode = {
    JwtParseError: "JwtParseError",
    AuthenticationError: "AuthenticationError",
    AuthorizationError: "AuthorizationError",
    RequestError: "RequestError",
    StateError: "StateError",
    NotFoundError: "NotFoundError"
}

/**
 * @param {string} code 
 * @param {string} message 
 * @returns {Error}
 */
export function error(code, message) {
    let error = new Error(message);
    error.name = code;
    return error;
}