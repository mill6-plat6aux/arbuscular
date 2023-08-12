/*!
 * Copyright 2023 Nomura Research Institute, Ltd.
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Created by Takuro Okada
 */

import { ok, equal } from "assert";
import { parse } from "../utility/body-parser.js"
import { Readable } from "stream";
import { UploadFile } from "../utility/files.js";

describe("Body Parser", () => {
    it("parse GET parameters", async () => {
        let request = {
            url: "/test?key1=value1&key2=value2",
            method: "GET",
            headers: {}
        };
        let parameters = await parse(request);
        ok(parameters != null);
        ok(typeof parameters == "object");
        equal(parameters.key1, "value1");
        equal(parameters.key2, "value2");
    });

    it("parse POST JSON", async () => {
        let request = Readable.from(Buffer.from(JSON.stringify({key1: "value1", key2: "value2"})));
        request.url = "/test";
        request.method = "POST";
        request.headers = {"content-type": "application/json"};
        request.emit("end");
        let parameters = await parse(request);
        ok(parameters != null);
        ok(typeof parameters == "object");
        equal(parameters.key1, "value1");
        equal(parameters.key2, "value2");
    });

    it("parse POST FromData", async () => {
        let body = `--hogehoge\r\nContent-Disposition: form-data; name="file"; filename="text.txt"\r\nContent-Type: text/plain\r\n\r\ntest\r\n--hogehoge\r\nContent-Disposition: form-data; name="key1"\r\n\r\nvalue1\r\n--hogehoge\r\nContent-Disposition: form-data; name="key2"\r\n\r\nvalue2\r\n--hogehoge--`;
        let request = Readable.from(Buffer.from(body));
        request.url = "/test";
        request.method = "POST";
        request.headers = {"content-type": "multipart/form-data; boundary=hogehoge"};
        request.emit("end");
        let parameters = await parse(request);
        ok(parameters != null);
        ok(typeof parameters == "object");
        ok(parameters.file instanceof UploadFile);
        equal(parameters.key1, "value1");
        equal(parameters.key2, "value2");
    });
});