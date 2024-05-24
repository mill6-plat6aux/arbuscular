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
import { writeError } from "./utility/logger.js";

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
    let requestPath = request.url != null ? request.url : "";
    if(setting.healthCheckPath && requestPath == setting.healthCheckPath) {
        response.writeHead(200, {
            "Access-Control-Allow-Origin": setting.acccessControl.allowOrigin,
            "X-Content-Type-Options": "nosniff",
            "Content-Type": "text/plain"
        });
        response.end();
        return;
    }
    let interfaceSpec = interfaces.find(interfaceSpec => {
        return requestPath == interfaceSpec.contextPath || 
            (requestPath.startsWith(interfaceSpec.contextPath) && 
            requestPath.substring(interfaceSpec.contextPath.length).startsWith("/"));
    });
    if(interfaceSpec == null) {
        response.writeHead(404, {
            "Access-Control-Allow-Origin": setting.acccessControl.allowOrigin,
            "X-Content-Type-Options": "nosniff",
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
        let headers = router.headers;
        headers["Content-Type"] = "text/plain";
        response.writeHead(500, headers);
        response.write("An error has occurred on the server. Please contact the administrator.");
        response.end();
    });
});
server.on("listening", () => {
    console.log(`Arbuscular is listening on ${setting.port}.`);
});
server.listen(setting.port);

export * from "./utility/body-parser.js";
export * from "./utility/errors.js";
export * from "./utility/files.js";
export * from "./utility/logger.js";