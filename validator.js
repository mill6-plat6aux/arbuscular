/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

export class Validator {

    /**
     * @param {any} value 
     * @param {import("./json-schema.d.ts").JsonSchema} spec 
     * @param {import("./openapi3.1.d.ts").Components} components 
     */
    static validate(value, spec, components) {
        if(spec.type == null && spec["$ref"] != null && components != null) {
            /** @type {Array<string>} */
            let references = spec["$ref"].split("/");
            /** @type {any} */
            let component;
            references.forEach(reference => {
                if(reference == "#" || reference == "components") return;
                if(components.schemas == null) return;
                if(component == null && components.schemas != null) {
                    component = components.schemas[reference];
                }else if(component != null) {
                    component = component[reference];
                }
            });
            if(component != null) {
                spec = component;
            }else {
                throw new Error(`The component ${spec["$ref"]} is not specified.`);
            }
        }
        if(spec.type == "string") {
            if(typeof value != "string") {
                throw new Error(`The data type is different from the definition [${spec.type}].`);
            }
            if(spec.format == "date-time") {
                if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}(T|t)[0-9]{2}:[0-9]{2}:[0-9]{2}(.[0-9]{3}|.[0-9]{6})*(Z|z|(\+|-)[0-9]{2}:[0-9]{2})$/.test(value)) {
                    throw new Error(`The data format is different from the definition [${spec.format}].`);
                }
            }else if(spec.format == "date") {
                if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
                    throw new Error(`The data format is different from the definition. [${spec.format}].`);
                }
            }else if(spec.format == "uuid") {
                if(!/^[0-9A-F]{8}-[0-9A-F]{4}-[1-4]{1}[0-9A-F]{3}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(value) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-4]{1}[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
                    throw new Error(`The data format is different from the definition. [${spec.format}].`);
                }
            }
            if(spec.enum != null) {
                if(!spec.enum.includes(value)) {
                    throw new Error(`The data deviates from the variation ${JSON.stringify(spec.enum)}.`);
                }
            }
        }else if(spec.type == "number") {
            if(typeof value != "number") {
                throw new Error(`The data type is different from the definition [${spec.type}].`);
            }
        }else if(spec.type == "boolean") {
            if(typeof value != "boolean") {
                throw new Error(`The data type is different from the definition [${spec.type}].`);
            }
        }else if(spec.type == "object") {
            if(typeof value != "object" || value == null) {
                throw new Error(`The data type is different from the definition [${spec.type}].`);
            }
            if(spec.properties != null) {
                let required = spec.required != null && Array.isArray(spec.required) ? spec.required : [];
                let properties = spec.properties;
                return Object.keys(properties).every(propertyName => {
                    let childValue = value[propertyName];
                    if(childValue === undefined) {
                        if(required.includes(propertyName)) {
                            throw new Error(`The property ${propertyName} is required.`);
                        }
                        return;
                    }
                    let childSpec = properties[propertyName];
                    try {
                        Validator.validate(childValue, childSpec, components);
                    }catch(/** @type {any} */error) {
                        throw new Error(`The value [${childValue}] of the property [${propertyName}] differs from the definition. ${error.message}`);
                    }
                });
            }
        }else if(spec.type == "array") {
            if(!Array.isArray(value)) {
                throw new Error(`The data type is different from the definition [${spec.type}].`);
            }
            let elementSpec = spec.items;
            return value.every(childValue => {
                if(elementSpec == null) return false;
                Validator.validate(childValue, elementSpec, components);
            });
        }else if(spec.type == "null") {
            if(value != null) {
                throw new Error(`The data type is different from the definition [${spec.type}].`);
            }
        }else if(Array.isArray(spec.type)) {
            let specs = spec.type;
            /** @type {Array<any>} */
            let errors = [];
            specs.forEach(type => {
                let _spec = Object.assign({}, spec);
                _spec.type = type;
                try {
                    Validator.validate(value, _spec, components);
                }catch(error) {
                    errors.push(error);
                }
            });
            if(errors.length == specs.length) {
                throw new Error(errors.map(error => error.message).join("\n"));
            }
        }else if(spec.type == null) {
            if(spec.anyOf != null && Array.isArray(spec.anyOf)) {
                let specs = spec.anyOf;
                /** @type {Array<any>} */
                let errors = [];
                specs.forEach(childSpec => {
                    try {
                        Validator.validate(value, childSpec, components);
                    }catch(error) {
                        errors.push(error);
                    }
                });
                if(errors.length == specs.length) {
                    throw new Error(errors.map(error => error.message).join("\n"));
                }
            }else if(spec.allOf != null && Array.isArray(spec.allOf)) {
                let specs = spec.allOf;
                /** @type {Array<any>} */
                let errors = [];
                specs.forEach(childSpec => {
                    try {
                        Validator.validate(value, childSpec, components);
                    }catch(error) {
                        errors.push(error);
                    }
                });
                if(errors.length > 0) {
                    throw new Error(errors.map(error => error.message).join("\n"));
                }
            }else if(spec.oneOf != null && Array.isArray(spec.oneOf)) {
                let specs = spec.oneOf;
                /** @type {Array<any>} */
                let errors = [];
                specs.forEach(childSpec => {
                    try {
                        Validator.validate(value, childSpec, components);
                    }catch(error) {
                        errors.push(error);
                    }
                });
                if(errors.length > 0 && errors.length != specs.length-1) {
                    throw new Error(errors.map(error => error.message).join("\n"));
                }
            }
        }
    }
}