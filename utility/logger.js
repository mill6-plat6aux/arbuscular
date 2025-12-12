/*!
 * Copyright 2017 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

import FileSystem from "fs";
import YAML from "yaml";

let logSettingFilePath = "log.yaml";

/**
 * @param {string} filePath 
 */
export function setLogSettingFilePath(filePath) {
    logSettingFilePath = filePath;
    loadSetting();
}

export const LogLevel = {
    debug: 1,
    info: 2,
    warning: 3,
    error: 4,
    critical: 5
};

let threshold = 2;

/**
 * @param {string} message 
 */
let _writeLog = (message) => {
    process.stdout.write(message);
}

/**
 * @param {string} message 
 */
let _writeError = (message) => {
    process.stderr.write(message);
}

loadSetting();

function loadSetting() {
    if(!FileSystem.existsSync(logSettingFilePath)) {
        return;
    }
    let settings = YAML.parse(FileSystem.readFileSync(logSettingFilePath, "utf8"));
    if(settings.threshold != null && typeof settings.threshold == "string") {
        if(settings.threshold == "debug") {
            threshold = LogLevel.debug;
        }else if(settings.threshold == "info") {
            threshold = LogLevel.info;
        }else if(settings.threshold == "warning") {
            threshold = LogLevel.warning;
        }else if(settings.threshold == "error") {
            threshold = LogLevel.error;
        }else if(settings.threshold == "critical") {
            threshold = LogLevel.critical;
        }
    }
    if(settings.output != null && typeof settings.output == "string") {
        _writeLog = (message) => {
            FileSystem.writeFile(settings.output, message, error => {
                if(error != null) {
                    console.error("failed to write the logfile.", settings.output, error.message);
                }
            });
        };
    }
    if(settings.errorOutput != null && typeof settings.errorOutput == "string") {
        _writeError = (message) => {
            FileSystem.writeFile(settings.errorOutput, message, error => {
                if(error != null) {
                    console.error("failed to write the logfile.", settings.errorOutput, error.message);
                }
            });
        };
    }
}

/**
 * @param {string} message 
 * @param {number} [logLevel] 
 * @param {boolean} [force]
 */
export function writeLog(message, logLevel, force) {
    if(logLevel == undefined) {
        logLevel = 2;
    }
    if((force == undefined || !force) && logLevel < threshold) {
        return;
    }
    _writeLog(dateString() + " " + message + "\n");
}

/**
 * @param {string} message 
 * @param {number} [logLevel] 
 * @param {boolean} [force] 
 */
export function writeError(message, logLevel, force) {
    if(logLevel == undefined) {
        logLevel = 4;
    }
    if((force == undefined || !force) && logLevel < threshold) {
        return;
    }
    _writeError(dateString() + " " + message + "\n");
}

function dateString() {
    let date = new Date();
    return date.getFullYear() + "/" + 
        ("00"+(date.getMonth()+1)).slice(-2) + "/" + 
        ("00"+date.getDate()).slice(-2) + " " + 
        ("00"+date.getHours()).slice(-2) + ":" + 
        ("00"+date.getMinutes()).slice(-2) + ":" + 
        ("00"+date.getSeconds()).slice(-2)
}
