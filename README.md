<div align="center">
    <div>
        <picture>
            <source media="(prefers-color-scheme: dark)" srcset="https://github.com/mill6-plat6aux/arbuscular/raw/main/images/title-w.svg"/>
            <img src="https://github.com/mill6-plat6aux/arbuscular/raw/main/images/title-b.svg" width="480"/>
        </picture>
    </div>
    <br/>
    The ultra-lightweight API server 😋
    <br/><br/><br/>
</div>


## Architecture

![Architecture](https://raw.github.com/mill6-plat6aux/arbuscular/main/images/architecture.svg)


## Setup

Create `arbuscular.yaml` at the top level of your Node.js project and write the following.

```yaml
port: 3000
interfaces:
  - contextPath: "example"
    interface: "./open-api.yaml"
    route: "./route.yaml"
    authentication:
      module: "./authentication.js"
      function: "authenticate"
    authorization:
      module: "./authorization.js"
      function: "authorize"
```

* `open-api.yaml` is the OpenAPI definition file in your Node.js project.
  * At least OAuth2 clientCredentials must be defined in `components.securitySchemes`.
* `route.yaml` associates the request URL with the JS module in your Node.js project.
* `authentication.js` is the OAuth authentication (client credentials grant) implementation in your Node.js project.
* `authenticate` is a function of `authentication.js` and is the logic that performs authentication.
* `authorization.js` is the OAuth authorization implementation in your Node.js project.
* `authorize` is a function of `authorization.js` and is the logic that performs authorization.

`route.yaml` is defined as follows.

```yaml
/users:
  GET:
    module: ./logic/users.js
    function: getUsers
  POST:
    module: ./logic/users.js
    function: addUser
```

Finally, `npm install arbuscular` in your Node.js project and `npx arbuscular` will start the API server on the specified port.

## License

[MIT](https://github.com/mill6-plat6aux/arbuscular/blob/main/LICENSE)


## Developers

[Takuro Okada](mailto:mill6.plat6aux@gmail.com)


---

&copy; Takuro Okada