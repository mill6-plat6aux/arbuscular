/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

import { JsonSchema } from "./json-schema";

export interface OpenAPI {
    openapi: string;
    info: Info;
    jsonSchemaDialect?: string;
    servers?: Array<Server>;
    paths: PathItems;
    webhooks?: PathItems;
    components?: Components;
    security?: Array<SecurityRequirement>;
    tags: Array<Tag>;
    externalDocs: ExternalDocumentation;
}

export interface Info {
    title: string;
    summary?: string;
    description?: string;
    termsOfService?: string;
    contact?: Contact;
    license?: License;
    version: string;
}

export interface Contact {
    name?: string;
    url?: string;
    email?: string;
}

export interface License {
    name: string;
    identifier?: string;
    url?: string;
}

export interface Server {
    url: string;
    description?: string;
    variables?: ServerVariables;
}

export interface ServerVariables {
    [key: string]: ServerVariable;
}

export interface ServerVariable {
    enum?: Array<string>;
    default: string;
    description?: string;
}

export interface PathItems {
    [key: string]: PathItem;
}

export interface PathItem {
    $ref?: string;
    summary?: string;
    description?: string;
    get?: Operation;
    put?: Operation;
    post?: Operation;
    delete?: Operation;
    options?: Operation;
    head?: Operation;
    patch?: Operation;
    trace?: Operation;
    servers?: Array<Server>;
    parameters?: Array<Parameter|Reference>;
}

export interface Operation {
    tags?: Array<string>;
    summary?: string;
    description?: string;
    externalDocs?: ExternalDocumentation;
    operationId?: string;
    parameters?: Array<Parameter|Reference>;
    requestBody?: RequestBody|Reference;
    responses?: Responses;
    callbacks?: Callbacks;
    deprecated?: boolean;
    security?: SecurityRequirement;
    servers?: Server;
}

export interface RequestBody {
    description?: string;
    content: Content;
    required?: boolean;
}

export interface Content {
    [key: string]: MediaType;
}

export interface MediaType {
    schema?: Schema;
    example?: any;
    examples?: Examples;
    encoding?: Encodings;
}

export interface Examples {
    [key: string]: Example|Reference;
}

export interface Encodings {
    [key: string]: Encoding;
}

export interface Schema extends JsonSchema {
    discriminator?: Discriminator;
    xml?: XML;
    externalDocs?: ExternalDocumentation;
    example?: any;
}

export interface Discriminator {
    propertyName: string;
    mapping?: Mappings;
}

export interface Mappings {
    [key: string]: string;
}

export interface ExternalDocumentation {
    description?: string;
    url: string;
}

export interface Parameter {
    name?: string;
    in: "query" | "header" | "path" | "cookie";
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    allowEmptyValue?: boolean;
    style?: string;
    explode?: boolean;
    allowReserved?: boolean;
    schema?: Schema;
    example?: any;
    examples?: Examples;
}

export interface XML {
    name?: string;
    namespace?: string;
    prefix?: string;
    attribute?: boolean;
    wrapped?: boolean;
}

export interface Example {
    summary?: string;
    description?: string;
    value?: any;
    externalValue?: string;
}

export interface Reference {
    $ref: string;
    summary?: string;
    description?: string;
}

export interface Encoding {
    contentType?: string;
    headers?: Headers;
    style?: string;
    explode?: boolean;
    allowReserved?: boolean;
}

export interface Headers {
    [key: string]: Header|Reference;
}

export interface Header {
    name: string;
    description?: string;
    externalDocs: ExternalDocumentation;
}

export interface Responses {
    [key: string]: Response|Reference;
}

export interface Response {
    description?: string;
    headers?: Headers;
    content?: Content;
    links?: Links;
}

export interface Links {
    [key: string]: Link|Reference;
}

export interface Link {
    operationRef?: string;
    operationId?: string;
    parameters: object;
    requestBody: any;
    description: string;
    server: Server;
}

export interface Callbacks {
    [key: string]: Callback|Reference;
}

export interface Callback {
    [key: string]: PathItem|Reference;
}

export interface SecurityRequirement {
    [key: string]: Array<string>;
}

export interface Components {
    schemas?: Schemas;
    responses?: Responses;
    parameters?: Parameters;
    examples?: Examples;
    requestBodies?: RequestBodies;
    headers?: Headers;
    securitySchemes?: SecuritySchemes;
    links?: PathItems;
    callbacks?: Callbacks;
    pathItems?: PathItems;
}

export interface Schemas {
    [key: string]: Schema;
}

export interface Parameters {
    [key: string]: Parameter|Reference;
}

export interface RequestBodies {
    [key: string]: Parameter|Reference;
}

export interface SecuritySchemes {
    [key: string]: SecurityScheme|Reference;
}

export interface SecurityScheme {
    type: "apiKey" | "http" | "mutualTLS" | "oauth2" | "openIdConnect";
    description?: string;
    name: string;
    in: "query" | "header" | "cookie";
    scheme: string;
    bearerFormat?: string;
    flows: OAuthFlows;
    openIdConnectUrl: string;
}

export interface OAuthFlows {
    implicit?: OAuthFlow;
    password?: OAuthFlow;
    clientCredentials?: OAuthFlow;
    authorizationCode?: OAuthFlow;
}

export interface OAuthFlow {
    authorizationUrl: string;
    tokenUrl: string;
    refreshUrl: string;
    scopes: object;
}

export interface Tag {
    name: string;
    description?: string;
    externalDocs?: ExternalDocumentation;
}