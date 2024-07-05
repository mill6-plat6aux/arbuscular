/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

/**
 * Authentication Function of the REST API
 * @param request HTTP request
 * @returns Return value of REST API (HTTP body), Usually contains access_token property
 */
export type authenticate = (request: IncomingMessage) => object;

/**
 * Authorization Function of the REST API
 * @param request HTTP request
 * @returns Session object returned from authorization functions (e.g., containing user IDs, etc.)
 */
export type authorize = (request: IncomingMessage) => object;

/**
 * Functions as REST API implementations
 * @param session Session object returned from authorization functions (e.g., containing user IDs, etc.)
 * @param request REST API parameters (HTTP body, query parameters, path parameters)
 * @returns  Return value of REST API (HTTP body) 
 */
export type handle = (session: object, request: object) => object;

/**
 * Parses HTTP requests and converts them to JSON objects.
 * @param request HTTP request
 * @param settings Parsing setting
 */
export async function parse(request: IncomingMessage, settings?: BodyParserSetting): Promise<any>;

export interface BodyParserSetting {
    formData: FormDataSetting;
}

export interface FormDataSetting {
    /**
     * MIME types that accepts requests.
     */
    validTypes: Array<string>;
}

/**
 * If an exception is thrown by the REST API implementations, it returns an HTTP error based on the ErrorCode.
 *   JwtParseError : 400
 *   AuthenticationError : 401
 *   AuthorizationError : 403
 *   RequestError : 400
 *   StateError : 403
 *   NotFoundError : 404
 */
export function error(code: ErrorCode, message: string): Error;

export class ErrorCode {
    static JwtParseError: string;
    static AuthenticationError: string;
    static AuthorizationError: string;
    static RequestError: string;
    static StateError: string;
    static NotFoundError: string;
}