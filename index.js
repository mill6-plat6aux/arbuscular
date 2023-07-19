#!/usr/bin/env node

/*!
 * Copyright 2023 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

/**
 * @typedef { import("http").IncomingMessage } IncomingMessage
 * @typedef { import("http").ServerResponse } ServerResponse
 */

import { readFileSync } from "fs";
import YAML from "yaml";
import Http from "http";
import { Router } from "./router.js";
import { writeError } from "./logger.js";

let settingFile = readFileSync("arbuscular.yaml", "utf8");
let setting = YAML.parse(settingFile);

let interfaces = setting.interfaces.map(interfaceSpec => {
    return {contextPath: interfaceSpec.contextPath, router: new Router(interfaceSpec)};
}).sort((entry1, entry2) => {
    let length1 = entry1.contextPath.length;
    let length2 = entry2.contextPath.length;
    return length1 < length2 ? 1 : (length1 > length2 ? -1 : 0);
});

if(setting.port == undefined) {
    setting.port = 3000;
}

if(setting.acccessControl == undefined) {
    setting.acccessControl = {
        allowOrigin: "*"
    };
}else if(setting.acccessControl.allowOrigin == undefined) {
    setting.acccessControl.allowOrigin = "*";
}

const server = Http.createServer((request, response) => {
    let interfaceSpec = interfaces.find(interfaceSpec => request.url?.startsWith(interfaceSpec.contextPath));
    if(interfaceSpec == null) {
        response.writeHead(404, {
            "Access-Control-Allow-Origin": setting.acccessControl.allowOrigin,
            "Content-Type": "text/plain"
        });
        response.write("Not found.");
        response.end();
        return;
    }
    /** @type {Router} */
    let router = interfaceSpec.router;
    router.route(request, response).catch(error => {
        writeError(error.message+"\n"+error.stack);
        response.writeHead(500, {
            "Access-Control-Allow-Origin": setting.acccessControl.allowOrigin,
            "Content-Type": "text/plain"
        });
        response.write("An error has occurred on the server. Please contact the administrator.");
        response.end();
    });
});
server.on("listening", () => {
    console.log(`Arbuscular is listening on ${setting.port}.`);
});
server.listen(setting.port);

export * from "./body-parser.js";
export * from "./errors.js";
export * from "./files.js";
export * from "./logger.js";