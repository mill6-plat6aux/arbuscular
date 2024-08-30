/*!
 * Copyright 2023 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

/**
 * @typedef { import("http").IncomingMessage } IncomingMessage
 * @typedef { import("http").ServerResponse } ServerResponse
 */

/**
 * @typedef {object} Module
 * @property {string} module Module file path
 * @property {string} function The function implemented in module
 */

/**
 * @typedef {object} AccessControl
 * @property {string} allowOrigin * or origin
 * @property {string} allowHeaders * or HTTP headers
 * @property {string} allowMethods * or HTTP methods
 * @property {boolean} httpsOnly
 */

/**
 * @typedef {object} RouterSetting
 * @property {string} contextPath
 * @property {string} interface Interface definition file (Open API ver3)
 * @property {string} route The path of the file that defines the relationship between the request path and the module
 * @property {Module} authentication
 * @property {Module} authorization 
 * @property {AccessControl} accessControl
 * @property {object} customHeaders
 * @property {object} customErrorHeaders
 */

import FileSystem from "fs";
import Path from "path";
import QueryString from "querystring";
import YAML from "yaml";
import { Validator } from "./validator.js";
import { parse } from "./utility/body-parser.js";
import { ErrorCode } from "./utility/errors.js";
import { DownloadFile } from "./utility/files.js";
import { LogLevel, writeLog, writeError } from "./utility/logger.js";

export class Router {
    /**
     * @param {RouterSetting} setting 
     */
    constructor(setting) {
        this.contextPath = setting.contextPath;
        this.spec;
        this.authPaths = [];
        this.authenticateFunction;
        this.authorizeFunction;

        if(setting.accessControl == undefined) {
            setting.accessControl = {
                allowOrigin: "*",
                allowHeaders: "*",
                allowMethods: "*",
                httpsOnly: false
            };
        }else {
            if(setting.accessControl.allowOrigin == undefined) {
                setting.accessControl.allowOrigin = "*";
            }
            if(setting.accessControl.allowHeaders == undefined) {
                setting.accessControl.allowHeaders = "*";
            }
            if(setting.accessControl.allowMethods == undefined) {
                setting.accessControl.allowMethods = "*";
            }
            if(setting.accessControl.httpsOnly == undefined) {
                setting.accessControl.httpsOnly = false;
            }
        }
        this.accessControl = setting.accessControl;

        this.customHeaders = setting.customHeaders;
        this.customErrorHeaders = setting.customErrorHeaders;

        if(setting.interface != null) {
            let interfaceDefinition;
            if(typeof setting.interface == "string") {
                interfaceDefinition = YAML.parse(FileSystem.readFileSync(setting.interface, "utf8"));
            }else {
                interfaceDefinition = setting.interface;
            }
            this.spec = interfaceDefinition;

            this.paths = interfaceDefinition.paths;
            this.components = interfaceDefinition.components;

            Object.keys(this.components.securitySchemes).forEach(key => {
                let entry = this.components.securitySchemes[key];
                if(entry.type == "oauth2" && entry.flows != null && entry.flows.clientCredentials != null && entry.flows.clientCredentials.tokenUrl != null) {
                    this.authPaths.push({
                        name: key,
                        url: entry.flows.clientCredentials.tokenUrl
                    });
                }
            });
        }
        if(setting.route != null) {
            let routeDefinition;
            if(typeof setting.interface == "string") {
                routeDefinition = YAML.parse(FileSystem.readFileSync(setting.route, "utf8"));
            }else {
                routeDefinition = setting.route;
            }
            if(routeDefinition != null) {
                Object.keys(routeDefinition).forEach(key => {
                    let methods = routeDefinition[key];
                    Object.keys(methods).forEach(method => {
                        if(/^[A-Z]+$/.test(method)) {
                            let _method = method.toLowerCase();
                            methods[_method] = methods[method];
                            delete methods[method];
                        }
                    });
                    routeDefinition[key] = methods;
                });
            }
            this.routeDefinition = routeDefinition;
        }
        if(setting.authentication != null && setting.authentication.module != null && setting.authentication.function != null) {
            import(Path.resolve(setting.authentication.module)).then(module => {
                /** @type {import("./index.d.ts").authenticate} */
                this.authenticateFunction = module[setting.authentication.function];
            });
        }
        if(setting.authorization != null && setting.authorization.module != null && setting.authorization.function != null) {
            import(Path.resolve(setting.authorization.module)).then(module => {
                /** @type {import("./index.d.ts").authorize} */
                this.authorizeFunction = module[setting.authorization.function];
            });
        }
    }

    /**
     * @param {IncomingMessage} request
     * @param {ServerResponse} response
     */
    async route(request, response) {
        if(request.method == null) {
            this.sendError(response, 404, "Not found.");
            return;
        }

        // preflight
        if(request.method == "OPTIONS") {
            this.sendSuccess(response);
            return;
        }

        if(request.url == null) {
            this.sendError(response, 404, "Not found.");
            return;
        }

        let requestPath = request.url.substring(this.contextPath.length);

        // retrieve query parameters
        let queryParameters;
        if(requestPath.includes("?")) {
            let index = requestPath.indexOf("?");
            if(index == requestPath.length-1) {
                this.sendError(response, 404, "Not found.");
                return;
            }
            queryParameters = QueryString.parse(requestPath.substring(index+1));
            requestPath = requestPath.substring(0, index);
        }

        let requestContentType = request.headers["content-type"];
        if(requestContentType != null && requestContentType.includes(";")) {
            requestContentType = requestContentType.substring(0,requestContentType.indexOf(";")).trim();
        }

        // retrieve auth spec
        let authSpec = this.authPaths.find(authPath => requestPath == authPath.url);
        if(authSpec != null && this.authenticateFunction != null) {
            writeLog(`${request.method} ${request.url}`, LogLevel.info);

            // authentication
            try {
                let result = await this.authenticateFunction(request);
                this.sendJson(response, result);
            }catch(error) {
                writeError(error.message);
                writeError(error.stack, LogLevel.debug);
                this.sendError(response, error);
            }
            return;
        }

        // retrieve spec
        let spec = this.paths[requestPath];

        let pathWithPathParameters;
        let pathParameters = [];
        if(spec == null) {
            pathWithPathParameters = this.retrievePathParameters(requestPath, pathParameters);
            if(pathWithPathParameters != null && pathParameters.length > 0) {
                spec = this.paths[pathWithPathParameters];
                pathParameters.reverse();
            }
        }

        if(spec == null) {
            writeLog(`No corresponding REST API was found. ${request.method} ${request.url}`, LogLevel.info);
            this.sendError(response, 404, "Not found.");
            return;
        }

        // retrieve method
        let methodSpec = spec[request.method.toLowerCase()];
        if(methodSpec != null) {
            if(spec.parameters != null && spec.parameters.length > 0) {
                methodSpec.parameters = spec.parameters;
            }
            spec = methodSpec;
        }else {
            writeLog(`No corresponding REST API was found. ${request.method} ${request.url}`, LogLevel.info);
            this.sendError(response, 404, "Not found.");
            return;
        }

        // authorization
        let session;
        if(spec.security != null && this.authorizeFunction != null) {
            try {
                session = await this.authorizeFunction(request);
            }catch(error) {
                writeLog(`${request.method} ${request.url}`, LogLevel.info);
                writeError(error.message+"\n"+error.stack);
                this.sendError(response, error);
                return;
            }
        }

        writeLog(`${request.method} ${request.url} ${session != null ? JSON.stringify(session) : ""}`, LogLevel.info);

        // retrieve routing target
        let target;
        if(pathWithPathParameters != null) {
            let route = this.routeDefinition[pathWithPathParameters];
            if(route != null) {
                target = route[request.method.toLocaleLowerCase()];
            }
        }else {
            let route = this.routeDefinition[requestPath];
            if(route != null) {
                target = route[request.method.toLocaleLowerCase()];
            }
        }
        if(target == null) {
            writeLog(`No matching module was found. ${request.method} ${request.url}`, LogLevel.info);
            this.sendError(response, 404, "Not found.");
            return;
        }

        let requestBody;

        // validate request
        if(spec.requestBody != null && spec.requestBody.content != null) {
            let parseSettings;
            if(target != null && target.validTypes != null) {
                parseSettings = {formData: target.validTypes};
            }
            requestBody = await parse(request, parseSettings);

            let requestSpec;
            if(requestContentType != null) {
                requestSpec = spec.requestBody.content[requestContentType];
            }
            if(requestSpec != null && requestSpec.schema != null) {
                try {
                    Validator.validate(requestBody, requestSpec.schema, this.components);
                }catch(error) {
                    writeError(`The request differs from the interface definition.\n${request.method} ${requestPath}\nRequest:\n${JSON.stringify(requestBody, null, 4)}\nDefinition:\n${JSON.stringify(requestSpec.schema, null, 4)}\n${error.message}`, LogLevel.error);
                    this.sendError(response, 400, "Request format is not supported.");
                    return;
                }
            }

            if(pathParameters.length > 0) {
                pathParameters.forEach((pathParameter, index) => {
                    if(index < spec.parameters.length && spec.parameters[index].in == "path") {
                        let key = spec.parameters[index].name;
                        let type = spec.parameters[index].schema.type;
                        if(type == "number" || type == "integer") {
                            requestBody[key] = Number(pathParameter);
                        }else if(type == "boolean") {
                            requestBody[key] = pathParameter == "true" || pathParameter == "1";
                        }else {
                            requestBody[key] = pathParameter;
                        }
                    }
                });
            }
        }else if(spec.parameters != null) {
            if(queryParameters != null) {
                requestBody = {};
                let result = spec.parameters.every(parameterSpec => {
                    if(parameterSpec.in != "query") {
                        return true;
                    }
                    let key = parameterSpec.name;
                    let type = parameterSpec.schema.type;
                    let value = queryParameters[key];
                    if(parameterSpec.required != undefined && parameterSpec.required && value === undefined) {
                        return false;
                    }
                    if(value !== undefined) {
                        if(type == "number") {
                            if(!/^[0-9.-]+$/.test(value)) {
                                return false;
                            }
                            requestBody[key] = Number(value);
                        }else if(type == "boolean") {
                            if(value != "true" && value != "false" && value != "1" && value != "0") {
                                return false;
                            }
                            requestBody[key] = value == "true" || value == "1";
                        }else {
                            requestBody[key] = value;
                        }
                    }
                    return true;
                });
                if(!result) {
                    this.sendError(response, 400, "Request format is not supported.");
                    return;
                }
            }else if(pathParameters.length > 0) {
                requestBody = {};
                pathParameters.forEach((pathParameter, index) => {
                    if(index < spec.parameters.length && spec.parameters[index].in == "path") {
                        let key = spec.parameters[index].name;
                        let type = spec.parameters[index].schema.type;
                        if(type == "number" || type == "integer") {
                            requestBody[key] = Number(pathParameter);
                        }else if(type == "boolean") {
                            requestBody[key] = pathParameter == "true" || pathParameter == "1";
                        }else {
                            requestBody[key] = pathParameter;
                        }
                    }
                });
            }
        }

        // invoke module
        if(target.module == null) {
            this.sendError(response, 404, "Not found.");
            return;
        }
        let module = await import(Path.resolve(target.module));
        if(module == null || target.function == null) {
            this.sendError(response, 404, "Not found.");
            return;
        }
        /** @type {import("./index.d.ts").handle} */
        let targetFunction = module[target.function];
        if(targetFunction == null) {
            this.sendError(response, 404, "Not found.");
            return;
        }
        let responseBody;
        try {
            responseBody = await targetFunction.apply(null, [session, requestBody, request.headers, response]);
        }catch(error) {
            writeError(error.message);
            writeError(error.stack, LogLevel.debug);
            this.sendError(response, error);
            return;
        }

        // validate response
        if(spec.responses != null && spec.responses["200"] != null) {
            if(responseBody != null && spec.responses["200"].content != null) {
                let responseSpec = spec.responses["200"].content;
                if(typeof responseBody == "object") {
                    if(responseBody instanceof DownloadFile) {
                        if(responseSpec[responseBody.dataType] != null) {
                            this.sendFile(response, responseBody.data, responseBody.dataType, responseBody.fileName);
                        }else {
                            writeError(`The response could not be processed successfully.\n${request.method} ${requestPath}\ndefinition: ${Object.keys(responseSpec).join(",")}, response: ${responseBody.dataType}`);
                            this.sendError(response, 500, "Internal server error.");
                        }
                    }else {
                        if(responseSpec["application/json"] != null) {
                            try {
                                Validator.validate(responseBody, responseSpec["application/json"].schema, this.components);
                            }catch(error) {
                                this.sendError(response, 500, "Internal server error.");
                                writeError(`The response differs from the interface definition.\n${request.method} ${requestPath}\nResponse:\n${JSON.stringify(responseBody, null, 4)}\nDefinition:\n${JSON.stringify(responseSpec["application/json"].schema, null, 4)}\n${error.message}`);
                                return;
                            }
                            this.sendJson(response, responseBody);
                        }else {
                            writeError(`The response could not be processed successfully.\n${request.method} ${requestPath}\ndefinition: ${Object.keys(responseSpec).join(",")}, response: ${responseBody}`);
                            this.sendError(response, 500, "Internal server error.");
                        }
                    }
                }else if(typeof responseBody == "string") {
                    if(responseSpec["text/plain"] != null) {
                        this.sendText(response, responseBody);
                    }else {
                        writeError(`The response could not be processed successfully.\n${request.method} ${requestPath}\ndefinition: ${Object.keys(responseSpec).join(",")}, response: ${responseBody}`);
                        this.sendError(response, 500, "Internal server error.");
                    }
                }else {
                    writeError(`The response could not be processed successfully.\n${request.method} ${requestPath}\ndefinition: ${Object.keys(responseSpec).join(",")}, response: ${responseBody}`);
                    this.sendError(response, 500, "Internal server error.");
                }
            }else {
                if(responseBody == null) {
                    this.sendSuccess(response);
                }else {
                    writeError(`The response definition is not found.\n${request.method} ${requestPath}`);
                    this.sendError(response, 500, "Internal server error.");
                }
            }
        }else {
            writeError(`The response definition is not found.\n${request.method} ${requestPath}`);
            this.sendError(response, 500, "Internal server error.");
        }
    }

    /**
     * @param {string} requestPath 
     * @param {Array<string>} pathParameters 
     * @returns {string | null} path as the spec key
     */
    retrievePathParameters(requestPath, pathParameters) {
        let index = requestPath.lastIndexOf("/");
        if(index == -1 || index == 0 || index == requestPath.length-1) {
            return null;
        }
        pathParameters.push(requestPath.substring(index+1));
        let _requestPath = requestPath.substring(0, index);
        let pattern = _requestPath;
        pathParameters.forEach(_ => pattern += "/{.+}");
        let path = Object.keys(this.paths).find(path => new RegExp("^"+pattern+"$").test(path));
        if(path != null) {
            return path;
        }else {
            return this.retrievePathParameters(_requestPath, pathParameters);
        }
    }

    /**
     * @returns {object}
     */
    get headers() {
        let headers = {
            "Access-Control-Allow-Origin": this.accessControl.allowOrigin,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store"
        };
        if(this.accessControl.httpsOnly) {
            headers["Strict-Transport-Security"] = "Strict-Transport-Security: max-age=31536000; includeSubDomains";
        }
        if(this.customHeaders != null) {
            Object.keys(this.customHeaders).forEach(key => {
                headers[key] = this.customHeaders[key];
            });
        }
        return headers;
    }

    /**
     * @returns {object}
     */
    get errorHeaders() {
        let headers = {
            "Access-Control-Allow-Origin": this.accessControl.allowOrigin,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store"
        };
        if(this.accessControl.httpsOnly) {
            headers["Strict-Transport-Security"] = "Strict-Transport-Security: max-age=31536000; includeSubDomains";
        }
        if(this.customErrorHeaders != null) {
            Object.keys(this.customErrorHeaders).forEach(key => {
                headers[key] = this.customErrorHeaders[key];
            });
        }
        return headers;
    }

    /**
     * @param {ServerResponse} response 
     * @param {object} data 
     */
    sendJson(response, data) {
        let headers = this.headers;
        headers["Content-Type"] = "application/json";
        response.writeHead(200, headers);
        response.write(JSON.stringify(data));
        response.end();
    }
    
    /**
     * @param {ServerResponse} response 
     * @param {Buffer} data 
     * @param {string} dataType 
     * @param {string | null} fileName 
     */
    sendFile(response, data, dataType, fileName) {
        let headers = this.headers;
        headers["Content-Type"] = dataType;
        if(fileName != null) {
            headers["Content-Disposition"] = `attachment; filename="${fileName}"`;
        }
        response.writeHead(200, headers);
        response.end(data);
    }
    
    /**
     * @param {ServerResponse} response 
     */
    sendText(response, text) {
        let headers = this.headers;
        headers["Content-Type"] = "text/plain";
        response.writeHead(200, text, headers);
        response.end();
    }
    
    /**
     * @param {ServerResponse} response 
     */
    sendSuccess(response) {
        let headers = this.headers;
        headers["Access-Control-Allow-Headers"] = this.accessControl.allowHeaders;
        headers["Access-Control-Allow-Methods"] = this.accessControl.allowMethods;
        response.writeHead(200, headers);
        response.end();
    }
    
    /**
     * @param {ServerResponse} response 
     * @param {number|Error} statusCode 
     * @param {string} [message] 
     */
    sendError(response, statusCode, message) {
        let headers = this.errorHeaders;
        if(typeof statusCode == "number") {
            headers["Content-Type"] = "text/plain";
        }
        if(typeof statusCode == "object" && statusCode instanceof Error) {
            let error = statusCode;
            if(error.name != null) {
                if(error.name == ErrorCode.AuthenticationError) {
                    statusCode = 401;
                    message = error.message;
                }else if(error.name == ErrorCode.AuthorizationError) {
                    statusCode = 403;
                    message = error.message;
                }else if(error.name == ErrorCode.JwtParseError) {
                    statusCode = 400;
                    message = error.message;
                }else if(error.name == ErrorCode.RequestError) {
                    statusCode = 400;
                    message = error.message;
                }else if(error.name == ErrorCode.StateError) {
                    statusCode = 403;
                    message = error.message;
                }else if(error.name == ErrorCode.NotFoundError) {
                    statusCode = 404;
                    message = error.message;
                }else {
                    statusCode = 500;
                    message = "An error has occurred on the server. Please contact the administrator.";
                }
            }else {
                statusCode = 500;
                message = "An error has occurred on the server. Please contact the administrator.";
            }
        }
        if(typeof statusCode == "number") {
            response.writeHead(statusCode, headers);
        }
        if(message != null) {
            response.write(message);
        }
        response.end();
    }
}