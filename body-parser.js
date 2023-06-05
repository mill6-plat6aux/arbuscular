/*!
 * Copyright 2021 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

/**
 * @typedef { import("http").IncomingMessage } IncomingMessage
 * @typedef { import("http").ServerResponse } ServerResponse
 */

import { URL } from "url";
import querystring from "querystring";
import Busboy from "busboy";

/**
 * @type {BodyParserSetting}
 */
export let settings;

/**
 * @typedef {object} FormDataSetting
 * @property {Array<string>} validTypes
 */

/**
 * @typedef {object} BodyParserSetting
 * @property {FormDataSetting} formData
 */

/**
 * @param {IncomingMessage} request
 * @returns {Promise<object>}
 */
export async function parse(request) {
    let contentType = request.headers["content-type"];
    let charset = "utf-8";
    if(contentType != null) {
        contentType = contentType.trim().toLowerCase();
        let delimiterIndex = contentType.indexOf(";");
        if(delimiterIndex != -1) {
            if(delimiterIndex < contentType.length-1) {
                let subDelimiterIndex = contentType.indexOf("charset=");
                if(subDelimiterIndex != -1) {
                    charset = contentType.substr(subDelimiterIndex+8);
                }
            }
            contentType = contentType.substring(0, delimiterIndex);
        }
    }
    let body;
    if(contentType == "application/json" || 
    contentType == "application/cloudevents+json") {
        try {
            body = await parseJson(charset, request);
        }catch(error) {
            throw new Error("Request HTTP body format is invalid.");
        }
    }else if(contentType == "multipart/form-data") {
        try {
            parseFormData(request);
        }catch(error) {
            throw new Error("The file format you specify is not supported.");
        }
    }else {
        let method = request.method != null ? request.method.toUpperCase() : "GET";
        if(method == "GET") {
            if(request.url == null) {
                return null;
            }
            let url = new URL(request.url, "http://"+request.headers.host);
            let parameters = url.searchParams;
            if(parameters != null) {
                let fields = {};
                parameters.forEach((value, name) => {
                    if(/^[0-9.]+$/.test(value)) {
                        fields[name] = Number(value);
                    }else {
                        fields[name] = value;
                    }
                });
                body = fields;
            }
        }else {
            body = await parseUrlEncoded(request);
            if(body != null) {
                Object.keys(body).forEach(key => {
                    let value = body[key];
                    if(/^[0-9.]+$/.test(value)) {
                        body[key] = Number(value);
                    }else {
                        body[key] = value;
                    }
                });
            }
        }
    }
    return body;
}

/**
 * @param {string} charset 
 * @param {IncomingMessage} request 
 */
async function parseJson(charset, request) {
    return new Promise((resolve, reject) => {
        let textDecoder = new TextDecoder(charset);
        let inputData;
        request.on("data", data => {
            if(inputData == undefined) {
                inputData = data;
            }else {
                inputData = Buffer.concat([inputData, data]);
            }
        });
        request.on("end", data => {
            if(inputData == undefined) {
                resolve(null);
                return;
            }
            let text = textDecoder.decode(inputData);
            let json;
            try{
                json = JSON.parse(text);
            }catch(error) {
                reject(error);
                return;
            }
            resolve(json);
        });
        request.on("error", error => {
            reject(error);
        });
    });
}

/**
 * @param {IncomingMessage} request 
 */
function parseFormData(request) {
    return new Promise((resolve, reject) => {
        let formDataTypes = settings.formData.validTypes;
        var busboy = Busboy({headers: request.headers});
        let fields = {};
        busboy.on("file", (fieldname, file, info) => {
            if(info == null) {
                reject(new Error("Invalid file attributes."));
                return;
            }
            if(formDataTypes != null && info.mimeType && !formDataTypes.includes(info.mimeType)) {
                reject(new Error("Invalid mime type: "+info.mimeType));
                return;
            }
            let buffer = null;
            file.on("data", (data) => {
                if(buffer == null) {
                    buffer = data;
                }else {
                    buffer = Buffer.concat([buffer, data]);
                }
            });
            file.on("end", () => {
                fields[fieldname] = {data: buffer, type: info.mimeType};
            });
        });
        busboy.on("field", function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
            if(/^[0-9.]+$/.test(val)) {
                fields[fieldname] = Number(val);
            }else {
                fields[fieldname] = val;
            }
        });
        busboy.on("finish", () => {
            resolve(fields);
        });
        request.pipe(busboy);
    });
}

/**
 * @param {IncomingMessage} request 
 */
function parseUrlEncoded(request) {
    return new Promise((resolve, reject) => {
        let inputData;
        request.on("data", data => {
            if(inputData == undefined) {
                inputData = data;
            }else {
                inputData = Buffer.concat([inputData, data]);
            }
        });
        request.on("end", data => {
            if(inputData == undefined) {
                resolve(null);
                return;
            }
            let body = querystring.parse(inputData.toString("utf8"));
            resolve(body);
        });
    });
}
