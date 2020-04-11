# @barchart/common-node-js

[![AWS CodeBuild](https://codebuild.us-east-1.amazonaws.com/badges?uuid=eyJlbmNyeXB0ZWREYXRhIjoiNmJ5Z1dYK2k4UTltRC82RVJxQ1ZzenVWTEFha0hqRnp2eHN3N3dpLzNIdzZmUDF4MGNFaGN4R1NKUFR6OUx5ajJEQUtYMkRXSXVHSDZPaTlnYVd1dzFzPSIsIml2UGFyYW1ldGVyU3BlYyI6Im96ZXJKeEltTWdSYkd5UnYiLCJtYXRlcmlhbFNldFNlcmlhbCI6MX0%3D&branch=master)](https://github.com/barchart/barchart-common-node-js)

A *public* library of shared JavaScript utilities. These utilities only suitable for Node.js environments.

### Overview

#### Features

* Promise-based convenience wrappers for the AWS services (including DynamoDB, S3, SES, SNS, SQS, more)
* Promise-based convenience wrappers for relational dB access (PostgreSQL, MySQL)
* Advanced utilities for working with Node.js streams
* A workflow engine based on a priority queue
* Pluggable asynchronous message bus for request-response (including an Amazon SQS implementation)
* Pluggable asynchronous message bus for publish-subscribe (including an Amazon SNS/SQS implementation)
* Quick HTTP servers with REST and/or Socket.IO endpoints (using Express)
* Browse the code...

#### Companion Library

A companion library called [@barchart/common-js](https://github.com/barchart/barchart-common-js) contains a more general set of utilities which are suitable for either Node.js or browser environments.

### Development

#### Documentation

The code is documented with [JSDoc](http://usejsdoc.org/). While the output hasn't been committed to source control, you can generate the documentation by using the following commands:

    > npm install
    > gulp document

#### Package Managers

This library has been published as a *public* module to NPM as [@barchart/common-node-js](https://www.npmjs.com/package/@barchart/common-node-js).

    > npm install @barchart/common-node-js -S

#### License

This software is provided under the MIT license.