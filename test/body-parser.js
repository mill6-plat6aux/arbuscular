/*!
 * Copyright 2023 Nomura Research Institute, Ltd.
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Created by Takuro Okada
 */

import { ok, equal } from "assert";
import { parse } from "../utility/body-parser.js"
import { Readable } from "stream";
import { UploadFile } from "../utility/files.js";

Promise.all([
    test1(),
    test2(),
    test3()
]).then(() => {
    console.log("Testing completed.");
});

async function test1() {
    console.log("parse GET parameters");
    let request = {
        url: "/test?key1=value1&key2=value2",
        method: "GET",
        headers: {}
    };
    let parameters = await parse(request);
    ok(parameters != null);
    ok(typeof parameters == "object");
    ok(parameters.data != null);
    ok(typeof parameters.data == "object");
    equal(parameters.data.key1, "value1");
    equal(parameters.data.key2, "value2");
}

async function test2() {
    console.log("parse POST JSON");
    let request = Readable.from(Buffer.from(JSON.stringify({key1: "value1", key2: "value2"})));
    request.url = "/test";
    request.method = "POST";
    request.headers = {"content-type": "application/json"};
    request.emit("end");
    let parameters = await parse(request);
    ok(parameters != null);
    ok(typeof parameters == "object");
    ok(parameters.data != null);
    ok(typeof parameters.data == "object");
    equal(parameters.data.key1, "value1");
    equal(parameters.data.key2, "value2");
}

async function test3() {
    console.log("parse POST FromData");
    let body = `--hogehoge\r\nContent-Disposition: form-data; name="file"; filename="text.txt"\r\nContent-Type: text/plain\r\n\r\ntest\r\n--hogehoge\r\nContent-Disposition: form-data; name="key1"\r\n\r\nvalue1\r\n--hogehoge\r\nContent-Disposition: form-data; name="key2"\r\n\r\nvalue2\r\n--hogehoge--`;
    let request = Readable.from(Buffer.from(body));
    request.url = "/test";
    request.method = "POST";
    request.headers = {"content-type": "multipart/form-data; boundary=hogehoge"};
    request.emit("end");
    let parameters = await parse(request);
    ok(parameters != null);
    ok(typeof parameters == "object");
    ok(parameters.data != null);
    ok(typeof parameters.data == "object");
    ok(parameters.data.file instanceof UploadFile);
    equal(parameters.data.key1, "value1");
    equal(parameters.data.key2, "value2");
}