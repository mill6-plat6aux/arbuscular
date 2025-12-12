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
import { UploadFile } from "./files.js";

/**
 * @typedef {object} FormDataSetting
 * @property {Array<string>} validTypes
 */

/**
 * @typedef {object} BodyParserSetting
 * @property {FormDataSetting} formData
 */

/**
 * @type {import("../index.d.ts").parse}
 */
export async function parse(request, settings) {
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
    /** @type {import("../index.js").BodyParserResult|null} */
    let body = null;
    if(contentType == "application/json" || 
    contentType == "application/cloudevents+json") {
        try {
            body = await parseJson(charset, request);
        }catch(error) {
            throw new Error("Request HTTP body format is invalid.");
        }
    }else if(contentType == "multipart/form-data") {
        try {
            body = await parseFormData(request, settings);
        }catch(/** @type {any} */error) {
            throw new Error("The file format you specify is not supported. "+error.message);
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
                /** @type {any} */
                let fields = {};
                parameters.forEach((value, name) => {
                    if(/^[0-9.]+$/.test(value)) {
                        fields[name] = Number(value);
                    }else {
                        fields[name] = value;
                    }
                });
                body = {data: fields, raw: null};
            }
        }else {
            body = await parseUrlEncoded(request);
            if(body != null) {
                let data = body.data;
                Object.keys(data).forEach(key => {
                    let value = data[key];
                    if(/^[0-9.]+$/.test(value)) {
                        data[key] = Number(value);
                    }else {
                        data[key] = value;
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
 * @returns {Promise<import("../index.js").BodyParserResult|null>}
 */
async function parseJson(charset, request) {
    return new Promise((resolve, reject) => {
        let textDecoder = new TextDecoder(charset);
        /** @type {Buffer|null} */
        let buffer;
        request.on("data", data => {
            if(buffer == undefined) {
                buffer = data;
            }else {
                buffer = Buffer.concat([buffer, data]);
            }
        });
        request.on("end", () => {
            if(buffer == undefined) {
                resolve(null);
                return;
            }
            let text = textDecoder.decode(buffer);
            let json;
            try{
                json = JSON.parse(text);
            }catch(error) {
                reject(error);
                return;
            }
            resolve({data: json, raw: buffer});
        });
        request.on("error", error => {
            reject(error);
        });
    });
}

/**
 * @param {IncomingMessage} request 
 * @param {BodyParserSetting} [settings]
 * @returns {Promise<import("../index.js").BodyParserResult|null>}
 */
function parseFormData(request, settings) {
    return new Promise((resolve, reject) => {
        let formDataTypes = (settings != null && settings.formData != null) ? settings.formData.validTypes : null;
        var busboy = Busboy({headers: request.headers});
        /** @type {any} */
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
            /** @type {Buffer|null} */
            let buffer = null;
            file.on("data", (data) => {
                if(buffer == null) {
                    buffer = data;
                }else {
                    buffer = Buffer.concat([buffer, data]);
                }
            });
            file.on("end", () => {
                if(buffer != null) {
                    fields[fieldname] = new UploadFile(buffer, info.mimeType, info.filename);
                }else {
                    fields[fieldname] = null;
                }
            });
        });
        busboy.on("field", /** @type {(name: string, value: string, info: import("busboy").FieldInfo) => void} */function(name, value, info) {
            if(/^[0-9.]+$/.test(value)) {
                fields[name] = Number(value);
            }else {
                fields[name] = value;
            }
        });
        busboy.on("finish", () => {
            resolve({data: fields, raw: null});
        });
        request.pipe(busboy);
    });
}

/**
 * @param {IncomingMessage} request 
 * @returns {Promise<import("../index.js").BodyParserResult|null>}
 */
function parseUrlEncoded(request) {
    return new Promise((resolve, reject) => {
        /** @type {Buffer|null} */
        let buffer;
        request.on("data", data => {
            if(buffer == undefined) {
                buffer = data;
            }else {
                buffer = Buffer.concat([buffer, data]);
            }
        });
        request.on("end", () => {
            if(buffer == undefined) {
                resolve(null);
                return;
            }
            let body = querystring.parse(buffer.toString("utf8"));
            resolve({data: body, raw: buffer});
        });
    });
}
