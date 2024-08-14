/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

export interface JsonSchema {
    $schema?: URI;
    $id?: URI;
    $ref?: URI;
    $def?: JsonSchemas;
    $comment?: string;
    $vocabulary?: Vocabulary;
    $dynamicRef?: URI;
    $dynamicAnchor?: string;
    $anchor?: string;
    
    allOf?: Array<JsonSchema>;
    anyOf?: Array<JsonSchema>;
    oneOf?: Array<JsonSchema>;
    then?: JsonSchema;
    if?: JsonSchema;
    else?: JsonSchema;
    not?: JsonSchema;
    properties?: JsonSchemas;
    additionalProperties?: JsonSchema;
    patternProperties?: JsonSchemas;
    dependentSchemas?: JsonSchemas;
    propertyNames?: JsonSchema;
    items?: JsonSchema;
    prefixItems?: Array<JsonSchema>;
    contains?: JsonSchema;

    type?: JsonType | Array<JsonType>;
    enum?: Array<any>;
    const?: any;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    exclusiveMaximum?: number;
    multipleOf?: number;
    exclusiveMinimum?: number;
    maximum?: number;
    minimum?: number;
    dependentRequired?: DependentRequired;
    maxProperties?: number;
    minProperties?: number;
    required?: Array<string>;
    maxItems?: number;
    minItems?: number;
    maxContains?: number;
    minContains?: number;
    uniqueItems?: boolean;

    title?: string;
    description?: string;
    default?: any;
    writeOnly?: boolean;
    readOnly?: boolean;
    examples?: Array<any>;
    deprecated?: boolean;

    format?: Format;

    unevaluatedProperties?: JsonSchema;
    unevaluatedItems?: JsonSchema;
    contentSchema?: JsonSchema;
    contentMediaType?: string;
    contentEncoding?: string;
}

export type URI = string;
export type JsonType = "null" | "boolean" | "object" | "array" | "number" | "integer" | "string";
export type Format = "date-time" | "date" | "time" | "duration" | "email" | "idn-email" | "hostname" | "idn-hostname" | "ipv4" | "ipv6" | "uri" | "uri-reference" | "iri" | "iri-reference" | "uuid" | "uri-template" | "json-pointer" | "relative-json-pointer" | "regex";

export interface JsonSchemas {
    [key: string]: JsonSchema;
}

export interface Vocabulary {
    [key: URI]: boolean;
}

export interface DependentRequired {
    [key: string]: Array<string>;
}