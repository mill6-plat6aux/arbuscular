/*!
 * Copyright 2023 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

export class UploadFile {
    /**
     * @param {Buffer} data 
     * @param {string} dataType MIME Types
     * @param {string} fileName File name
     */
    constructor(data, dataType, fileName) {
        this.data = data;
        this.dataType = dataType;
        this.fileName = fileName;
    }
}

export class DownloadFile {
    /**
     * @param {Buffer} data 
     * @param {string} dataType MIME Types
     * @param {string} fileName File name
     */
    constructor(data, dataType, fileName) {
        this.data = data;
        this.dataType = dataType;
        this.fileName = fileName;
    }
}