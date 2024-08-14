#!/usr/bin/env node

/*!
 * Copyright 2024 Takuro Okada.
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
import { setLogSettingFilePath, writeError } from "./utility/logger.js";

let settingFilePath = "arbuscular.yaml";
let logSettingFilePath = "log.yaml";

if(process.argv.length > 2) {
    let args = process.argv;
    for(let i=2; i<args.length; i++) {
        let argument = args[i];
        if(argument.startsWith("--") && argument.length > 1) {
            let key = argument.substring(2);
            let value;
            if(i<args.length-1) {
                value = args[i+1];
                i++;
            }
            if(value == null) continue;
            if(key == "setting") {
                settingFilePath = value;
            }else if(key == "log") {
                logSettingFilePath = value;
            }
        }
    }
}

setLogSettingFilePath(logSettingFilePath);

let settingFile = readFileSync(settingFilePath, "utf8");
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

if(setting.accessControl == undefined) {
    setting.accessControl = {
        allowOrigin: "*"
    };
}else if(setting.accessControl.allowOrigin == undefined) {
    setting.accessControl.allowOrigin = "*";
}

const server = Http.createServer((request, response) => {
    let requestPath = request.url != null ? request.url : "";
    if(setting.healthCheckPath && requestPath == setting.healthCheckPath) {
        response.writeHead(200, {
            "Access-Control-Allow-Origin": setting.accessControl.allowOrigin,
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
            "Access-Control-Allow-Origin": setting.accessControl.allowOrigin,
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