/*!
 * Copyright 2023 Nomura Research Institute, Ltd.
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Created by Takuro Okada
 */

import { ok, equal, rejects } from "assert";
import { Readable } from "stream";
import { Router } from "../router.js";

let router = new Router({
    contextPath: "",
    interface: {
        paths: {
            "/test": {
                "get": {
                    security: [
                        {
                            BearerAuth: []
                        }
                    ],
                    parameters: [
                        {
                            schema:{
                                type: "string"
                            },
                            in: "query",
                            name: "param1"
                        }
                    ],
                    responses: {
                        "200": {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            "key1": {
                                                type: "string"
                                            },
                                            "key2": {
                                                type: "string"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                "post": {
                    security: [
                        {
                            BearerAuth: []
                        }
                    ],
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        "key1": {
                                            type: "string"
                                        },
                                        "key2": {
                                            type: "string"
                                        }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        "200": {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            "key1": {
                                                type: "string"
                                            },
                                            "key2": {
                                                type: "string"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        components: {
            securitySchemes: {
                "BearerAuth": {
                    type: "oauth2",
                    flows: {
                        clientCredentials: {
                            tokenUrl: "/token"
                        }
                    }
                }
            }
        }
    },
    route: {
        "/test": {
            "GET": {
                module: "./test/router.js",
                function: "testGet"
            },
            "POST": {
                module: "./test/router.js",
                function: "testPost"
            }
        }
    },
    authentication: {
        module: "./test/router.js",
        function: "authenticate"
    },
    authorization: {
        module: "./test/router.js",
        function: "authorize"
    },
    accessControl: {
        allowOrigin: "*",
        allowHeaders: "Content-Type, Authorization",
        allowMethods: "GET, POST, PUT, DELETE"
    }
});

export async function authenticate() {
    return {access_token: "TOKEN", token_type: "Bearer"};
}

export async function authorize() {
    return {userId: 1, companyId: 1};
}

export async function testGet(session, request) {
    return {key1: session.userId.toString(), key2: request.param1};
}

export async function testPost(session, request) {
    return {key1: request.key1, key2: request.key2};
}

setTimeout(() => {
    Promise.all([
        test1(),
        test2()
    ]).then(() => {
        console.log("Testing completed.");
    });
}, 0);

function test1() {
    console.log("route GET request");
    return new Promise((resolve, reject) => {
        let request = {
            url: "/test?param1=param1Value",
            method: "GET",
            headers: {}
        };
        router.route(request, {
            writeHead: (statusCode, headers) => {
                equal(statusCode, 200);
            },
            write: expression => {
                ok(expression != null);
                let response = JSON.parse(expression);
                ok(typeof response == "object");
                equal(response.key1, "1");
                equal(response.key2, "param1Value");
            },
            end: () => {
                resolve();
            }
        });
    });
}

function test2() {
    console.log("route POST request");
    return new Promise((resolve, reject) => {
        let request = Readable.from(Buffer.from(JSON.stringify({key1: "value1", key2: "value2"})));
        request.url = "/test";
        request.method = "POST";
        request.headers = {"content-type": "application/json"};
        request.emit("end");
        router.route(request, {
            writeHead: (statusCode, headers) => {
                equal(statusCode, 200);
            },
            write: expression => {
                ok(expression != null);
                let response = JSON.parse(expression);
                ok(typeof response == "object");
                equal(response.key1, "value1");
                equal(response.key2, "value2");
            },
            end: () => {
                resolve();
            }
        });
    });
}