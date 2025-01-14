/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

import { IncomingMessage, IncomingHttpHeaders, ServerResponse, Server } from "http";
import { JsonSchema } from "./json-schema.d.ts";
import { Components } from "./openapi3.1.d.ts";

/**
 * Authentication Function of the REST API
 * @param request HTTP request
 * @returns Return value of REST API (HTTP body), Usually contains access_token property
 */
export type authenticate = (request: IncomingMessage) => Promise<any>;

/**
 * Authorization Function of the REST API
 * @param request HTTP request
 * @returns Session object returned from authorization functions (e.g., containing user IDs, etc.)
 */
export type authorize = (request: IncomingMessage) => Promise<any>;

/**
 * Functions as REST API implementations
 * @param session Session object returned from authorization functions (e.g., containing user IDs, etc.)
 * @param request REST API parameters (HTTP request body, query parameters, path parameters)
 * @param requestHeaders HTTP request headers
 * @param response HTTP response
 * @returns  Return values of REST API (HTTP response body) 
 */
export type handle = (session: any, requestBody: any, requestHeaders?: IncomingHttpHeaders, response?: ServerResponse) => Promise<any>;

/**
 * Parses HTTP requests and converts them to JSON objects.
 * @param request HTTP request
 * @param settings Parsing setting
 */
export function parse(request: IncomingMessage, settings?: BodyParserSetting): Promise<any>;

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
 * @deprecated Use ErrorResponse instead.
 */
export function error(code: ErrorCode, message: string): Error;

/**
 * If an exception is thrown by the REST API implementations, it returns an HTTP error based on the ErrorCode.
 *   JwtParseError : 400
 *   AuthenticationError : 401
 *   AuthorizationError : 403
 *   RequestError : 400
 *   StateError : 403
 *   NotFoundError : 404
 */
export function ErrorResponse(code: ErrorCode, message: string): Error;

export class ErrorCode {
    static JwtParseError: string;
    static AuthenticationError: string;
    static AuthorizationError: string;
    static RequestError: string;
    static StateError: string;
    static NotFoundError: string;
}

export function writeLog(message: string, logLevel?: number, force?: boolean);
export function writeError(message: string, logLevel?: number, force?: boolean);

export class LogLevel {
    static debug: number;
    static info: number;
    static warning: number;
    static error: number;
    static critical: number;
}

export class Validator {
    /**
     * Use this method when dynamically verifying conformance to the OpenAPI specification or JSON schema.
     * @param value target object
     * @param spec JSON Schema (Part of the OpenAPI specification)
     * @param components Component definition of OpenAPI specification
     */
    static validate(value: any, spec: JsonSchema, components: Components): void;
}

export class UploadFile {
    data: Buffer;
    /** MIME Types */
    dataType: String;
    fileName: String;
}

export class DownloadFile {
    /**
     * @param data 
     * @param dataType MIME Types
     * @param fileName 
     */
    constructor(data: Buffer, dataType: String, fileName: String | null);
}

export function extendServer(server: Server);