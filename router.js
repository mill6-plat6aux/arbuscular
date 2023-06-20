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
 * @typedef {object} Schema
 * @property {"string"|"number"|"boolean"|"object"|"array"} type
 * @property {"date-time"|"date"|"time"|"email"|"uuid"} format
 * @property {object} properties
 * @property {Schema} items
 */

import FileSystem from "fs";
import Path from "path";
import QueryString from "querystring";
import YAML from "yaml";
import { parse } from "./body-parser.js";
import { error, ErrorCode } from "./errors.js";
import { DownloadFile } from "./files.js";
import { LogLevel, writeError, writeLog } from "./logger.js";

export class Router {
    constructor(setting) {
        this.contextPath = setting.contextPath;
        this.spec;
        this.authPaths = [];
        this.authenticateFunction;
        this.authorizeFunction;

        if(setting.interface != null) {
            let interfaceDefinition = YAML.parse(FileSystem.readFileSync(setting.interface, "utf8"));
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
            this.routeDefinition = YAML.parse(FileSystem.readFileSync(setting.route, "utf8"));
        }
        if(setting.authentication != null && setting.authentication.module != null && setting.authentication.function != null) {
            import(Path.resolve(setting.authentication.module)).then(module => {
                /** @type {import("./spi.js").authenticate} */
                this.authenticateFunction = module[setting.authentication.function];
            });
        }
        if(setting.authorization != null && setting.authorization.module != null && setting.authorization.function != null) {
            import(Path.resolve(setting.authorization.module)).then(module => {
                /** @type {import("./spi.js").authorize} */
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
            sendError(response, 404, "Not found.");
            return;
        }

        // Preflight
        if(request.method == "OPTIONS") {
            sendSuccess(response);
            return;
        }

        if(request.url == null) {
            sendError(response, 404, "Not found.");
            return;
        }

        writeLog(`${request.method} ${request.url}`, LogLevel.debug);

        let requestPath = request.url.substring(this.contextPath.length);

        // retrieve query parameters
        let queryParameters;
        if(requestPath.includes("?")) {
            let index = requestPath.indexOf("?");
            if(index == requestPath.length-1) {
                sendError(response, 404, "Not found.");
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
            // authentication
            try {
                let result = await this.authenticateFunction(request);
                sendJson(response, result);
            }catch(error) {
                writeError(error.message+"\n"+error.stack);
                sendError(response, error);
            }
            return;
        }

        // retrieve spec
        let spec = this.paths[requestPath];

        let pathParameter;
        
        if(spec == null) {
            // retrieve path parameter
            let index = requestPath.lastIndexOf("/");
            if(index == requestPath.length-1) {
                sendError(response, 404, "Not found.");
                return;
            }
            let _requestPath = requestPath.substring(0, index+1);
            let path = Object.keys(this.paths).find(path => path.startsWith(_requestPath));
            if(path != null) {
                spec = this.paths[path];
            }
            if(path != null && spec != null) {
                pathParameter = requestPath.substring(index+1);
                requestPath = path;
            }else {
                writeLog(`Requested with a path parameter, but no corresponding REST API was found. ${request.method} ${request.url}`, LogLevel.info);
                sendError(response, 404, "Not found.");
                return;
            }
        }

        // retrieve method
        let methodSpec = spec[request.method.toLowerCase()];
        if(methodSpec != null) {
            if(spec.parameters != null) {
                methodSpec.parameters = spec.parameters;
            }
            spec = methodSpec;
        }else {
            writeLog(`No corresponding REST API was found. ${request.method} ${request.url}`, LogLevel.info);
            sendError(response, 404, "Not found.");
            return;
        }

        // authorization
        let session;
        if(spec.security != null && this.authorizeFunction != null) {
            try {
                session = await this.authorizeFunction(request);
            }catch(error) {
                writeError(error.message+"\n"+error.stack);
                sendError(response, error);
                return;
            }
        }

        // retrieve routing target
        let target;
        if(pathParameter != null) {
            let index = requestPath.lastIndexOf("/");
            if(index == requestPath.length-1) {
                sendError(response, 404, "Not found.");
                return;
            }
            let _requestPath = requestPath.substring(0, index+1);
            let path = Object.keys(this.routeDefinition).find(path => path.startsWith(_requestPath));
            if(path != null) {
                let route = this.routeDefinition[path];
                if(route != null) {
                    target = route[request.method];
                }
            }
        }else {
            let route = this.routeDefinition[requestPath];
            if(route != null) {
                target = route[request.method];
            }
        }
        if(target == null) {
            writeLog(`No matching module was found. ${request.method} ${request.url}`, LogLevel.info);
            sendError(response, 404, "Not found.");
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
                if(!Router.validate(requestBody, requestSpec.schema, this.components)) {
                    sendError(response, 400, "Request format is not supported.");
                    return;
                }
            }
        }else if(spec.parameters != null) {
            if(queryParameters != null) {
                requestBody = {};
                let result = spec.parameters.every(parameterSpec => {
                    if(parameterSpec.in != "query") {
                        return false;
                    }
                    let key = parameterSpec.name;
                    let type = parameterSpec.schema.type;
                    if(type == "number") {
                        requestBody[key] = Number(queryParameters[key]);
                    }else {
                        requestBody[key] = queryParameters[key];
                    }
                    return true;
                });
                if(!result) {
                    sendError(response, 400, "Request format is not supported.");
                    return;
                }
            }else if(pathParameter != null) {
                if(spec.parameters.length == 1 && spec.parameters[0].in == "path") {
                    let key = spec.parameters[0].name;
                    let type = spec.parameters[0].schema.type;
                    requestBody = {};
                    if(type == "number") {
                        requestBody[key] = Number(pathParameter);
                    }else {
                        requestBody[key] = pathParameter;
                    }
                }
            }
        }

        // invoke module
        if(target.module == null) {
            sendError(response, 404, "Not found.");
            return;
        }
        let module = await import(Path.resolve(target.module));
        if(module == null || target.function == null) {
            sendError(response, 404, "Not found.");
            return;
        }
        /** @type {import("./spi.js").handle} */
        let targetFunction = module[target.function];
        if(targetFunction == null) {
            sendError(response, 404, "Not found.");
            return;
        }
        let responseBody;
        try {
            responseBody = await targetFunction.apply(null, [session, requestBody]);
        }catch(error) {
            writeError(error.message+"\n"+error.stack);
            sendError(response, error);
            return;
        }

        // validate response
        if(spec.responses != null && spec.responses["200"] != null) {
            if(responseBody != null && spec.responses["200"].content != null) {
                let responseSpec = spec.responses["200"].content;
                if(typeof responseBody == "object") {
                    if(responseBody instanceof DownloadFile) {
                        if(responseSpec["application/pdf"] != null) {
                            sendFile(response, responseBody.data, responseBody.dataType, responseBody.fileName);
                        }else {
                            sendError(response, 500, "Internal server error.");
                            throw new Error("Unknown content type.");
                        }
                    }else {
                        if(responseSpec["application/json"] != null) {
                            if(!Router.validate(responseBody, responseSpec["application/json"].schema, this.components)) {
                                sendError(response, 500, "Internal server error.");
                                throw error(ErrorCode.StateError, "The data to be returned does not match the specification.");
                            }
                            sendJson(response, responseBody);
                        }else {
                            sendError(response, 500, "Internal server error.");
                            throw new Error("Unknown content type.");
                        }
                    }
                }
            }else {
                sendSuccess(response);
            }
        }else {
            sendError(response, 500, "Internal server error.");
            throw new Error("Response spec is not found in the interface definition.");
        }
    }

    /**
     * @param {*} value 
     * @param {Schema} spec 
     * @param {object} components 
     * @returns {boolean}
     */
    static validate(value, spec, components) {
        if(spec.type == null && spec["$ref"] != null && components != null) {
            let references = spec["$ref"].split("/");
            let component;
            references.forEach(reference => {
                if(reference == "#" || reference == "components") return;
                component = component == null ? components[reference] : component[reference];
            });
            if(component != null) {
                spec = component;
            }
        }
        if(spec.type == "string") {
            if(typeof value != "string") {
                return false;
            }
            if(spec.format == "date-time") {
                if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/.test(value)) {
                    return false;
                }
            }else if(spec.format == "uuid") {
                if(!/^[0-9A-F]{8}-[0-9A-F]{4}-[1-4]{1}[0-9A-F]{3}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(value)) {
                    return false;
                }
            }
        }else if(spec.type == "number") {
            if(typeof value != "number") {
                return false;
            }
        }else if(spec.type == "boolean") {
            if(typeof value != "boolean") {
                return false;
            }
        }else if(spec.type == "object") {
            if(typeof value != "object") {
                return false;
            }
            if(spec.properties != null) {
                Object.keys(spec.properties).forEach(propertyName => {
                    Router.validate(value[propertyName], spec.properties[propertyName], components);
                });
            }
        }else if(spec.type == "array") {
            if(!Array.isArray(value)) {
                return false;
            }
            let elementSpec = spec.items;
            value.forEach(childValue => {
                Router.validate(childValue, elementSpec, components);
            });
        }
        return true;
    }
}

/**
 * @param {ServerResponse} response 
 * @param {object} data 
 */
function sendJson(response, data) {
    response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
    });
    response.write(JSON.stringify(data));
    response.end();
}

/**
 * @param {ServerResponse} response 
 * @param {Buffer} data 
 * @param {string} dataType 
 * @param {string} fileName 
 */
function sendFile(response, data, dataType, fileName) {
    response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": dataType
    });
    response.end(data);
}

/**
 * @param {ServerResponse} response 
 */
function sendSuccess(response) {
    response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE"
    });
    response.end();
}

/**
 * @param {ServerResponse} response 
 * @param {number|Error} statusCode 
 * @param {string} [message] 
 */
function sendError(response, statusCode, message) {
    if(typeof statusCode == "object" && statusCode instanceof Error) {
        let error = statusCode;
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
    }
    if(typeof statusCode == "number") {
        response.writeHead(statusCode, {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "text/plain"
        });
    }
    if(message != null) {
        response.write(message);
    }
    response.end();
}