import { IncomingMessage } from "http";

/**
 * Authentication Function of the REST API
 * @param {IncomingMessage} request HTTP request
 * @returns {object} Return value of REST API (HTTP body), Usually contains access_token property
 */
export type authenticate = (request: IncomingMessage) => object;

/**
 * Authorization Function of the REST API
 * @param {IncomingMessage} request HTTP request
 * @returns {object} Session object returned from authorization functions (e.g., containing user IDs, etc.)
 */
export type authorize = (request: IncomingMessage) => object;

/**
 * Functions as REST API implementations
 * @param {object} session Session object returned from authorization functions (e.g., containing user IDs, etc.)
 * @param {object} request REST API parameters (HTTP body, query parameters, path parameters)
 * @returns {object} Return value of REST API (HTTP body) 
 */
export type handle = (session: object, request: object) => object;