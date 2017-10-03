const log4js = require('log4js');

const assert = require('@barchart/common-js/lang/assert'),
	is = require('@barchart/common-js/lang/is'),
	Serializer = require('@barchart/common-js/timing/Serializer');

const HttpProvider = require('./../../network/http/HttpProvider'),
	LambdaEnvironment = require('./LambdaEnvironment'),
	MessageProcessor = require('./MessageRouter'),
	MessageRouter = require('./MessageRouter'),
	S3Provider = require('./../S3Provider'),
	SesProvider = require('./../SesProvider'),
	SnsProvider = require('./../SnsProvider'),
	SqsProvider = require('./../SqsProvider'),
	TwilioProvider = require('./../../sms/TwilioProvider');

module.exports = (() => {
	'use strict';

	log4js.configure({
		"categories": {
			"default": { "appenders": [ "console" ], "level": "info" },
		},
		"appenders": {
			"console": {
				"type": "console",
					"layout": {
					"type": "pattern",
						"pattern": "[%d] [%p] %c - %m%"
				}
			}
		}
	});

	const logger = log4js.getLogger('lambda/LambdaBuilder');

	/**
	 * A builder pattern for assembling the AWS lambda functions (using the Node.js 4.3 or 6.10).
	 *
	 * @public
	 */
	class LambdaBuilder {
		constructor() {
			this._environment = null;

			this._messageExtractor = null;
			this._messageProcessor = null;
			this._outputTransformer = null;

			this._componentInitializers = [ ];
		}

		/**
		 * Specifies the environment and returns the current instance.
		 *
		 * @public
		 * @param {LambdaEnvironment} environment
		 * @returns {LambdaBuilder}
		 */
		withEnvironment(environment) {
			assert.argumentIsRequired(environment, 'environment', LambdaEnvironment, 'LambdaEnvironment');

			if (this._environment !== null) {
				throw new Error('The "environment" has already been defined');
			}

			this._environment = environment;

			return this;
		}

		/**
		 * Specifies the function used "extract" the item(s) to which should be
		 * processed (see {@link LambdaBuilder#usingMessageProcessor}). The
		 * current instance is returned.
		 *
		 * @public
		 * @param {Function} messageExtractor
		 * @returns {LambdaBuilder}
		 */
		usingMessageExtractor(messageExtractor) {
			assert.argumentIsRequired(messageExtractor, 'messageExtractor', Function);

			if (this._messageExtractor !== null) {
				throw new Error('The "messageExtractor" has already been defined');
			}

			this._messageExtractor = messageExtractor;

			return this;
		}

		/**
		 * Specifies the function used the input (after extraction). This function is executed
		 * once per item generated by the {@link LambdaBuilder#usingMessageExtractor}. The
		 * current instance is returned.
		 *
		 * @public
		 * @param {Function} messageExtractor
		 * @returns {LambdaBuilder}
		 */
		usingMessageProcessor(messageProcessor) {
			assert.argumentIsRequired(messageProcessor, 'messageProcessor', Function);

			if (this._messageProcessor !== null) {
				throw new Error('The "messageProcessor" (or router) has already been defined');
			}

			this._messageProcessor = MessageProcessor.fromFunction(messageProcessor);

			return this;
		}

		/**
		 * Specifies a group of functions to "process" the Lambda's input (after extraction).
		 * The router selects the appropriate function, based on the input. The current instance
		 * is returned.
		 *
		 * @public
		 * @param {Function} callback - The {@link MessageRouter} is passed synchronously to this callback.
		 * @returns {LambdaBuilder}
		 */
		usingMessageRouter(callback) {
			assert.argumentIsRequired(callback, 'callback', Function);

			if (this._messageProcessor !== null) {
				throw new Error('The "messageRouter" (or processor) has already been defined');
			}

			this._messageProcessor = new MessageRouter();

			callback(this._messageProcessor);

			return this;
		}

		/**
		 * In some circumstances, output can be passed back to the system that triggered
		 * the Lambda function (e.g. the API Gateway). If supplied, this function accepts
		 * the array of results from the {@link LambdaBuilder#usingMessageExtractor}
		 * invocations and returns them to the invoking system. The current instance
		 * is returned.
		 *
		 * @public
		 * @param {Function} messageExtractor
		 * @returns {LambdaBuilder}
		 */
		usingOutputProcessor(outputTransformer) {
			assert.argumentIsRequired(outputTransformer, 'outputTransformer', Function);

			if (this._outputTransformer !== null) {
				throw new Error('The "outputTransformer" has already been defined');
			}

			this._outputTransformer = outputTransformer;

			return this;
		}

		/**
		 * Specifies a function that returns a component to be used during processing
		 * (see {@link LambdaBuilder#usingMessageProcessor}) and returns the current
		 * instance.
		 *
		 * @public
		 * @param {Function} componentInitializer - Promise-based function that returns a "component" for use by the "processor" function.
		 * @param {String} componentName - Name of the component (in the map passed to the "processor" function.
		 * @returns {LambdaBuilder}
		 */
		usingComponentInitializer(componentInitializer, componentName) {
			assert.argumentIsRequired(componentInitializer, 'componentInitializer', Function);
			assert.argumentIsRequired(componentName, 'componentName', String);

			if (this._componentInitializers.find((c) => c.name === componentName)) {
				throw new Error('A component initializer with the same name has already been defined');
			}

			this._componentInitializers.push({name: componentName, initializer: componentInitializer});

			return this;
		}

		/**
		 * Constructs and returns the function used for processing the Lambda function's
		 * events.
		 *
		 * @public
		 * @returns {Function}
		 */
		build() {
			let runCounter = 0;

			const environment = this._environment || LambdaEnvironment.getInstance();

			const messageExtractor = this._messageExtractor || LambdaBuilder.getEmptyExtractor();
			const messageProcessor = this._messageProcessor || MessageRouter.fromFunction(LambdaBuilder.getEmptyProcessor());
			const outputTransformer = this._outputTransformer || null;

			const componentInitializers = Array.from(this._componentInitializers);

			return (event, context, callback) => {
				const start = new Date();

				let run = ++runCounter;

				logger.info(`starting run ${run} for ${environment.getName()} in ${environment.getMode()} mode`);

				return Promise.resolve({ })
					.then((context) => {
						logger.debug('extracting messages for run', run);

						return messageExtractor(event)
							.then((messages) => Object.assign(context, { messages: messages }));
					}).then((context) => {
						logger.debug('initializing', componentInitializers.length, 'components for run', run);

						return Promise.all(componentInitializers.map((ci) => {
							return Promise.resolve()
								.then(() => {
									return ci.initializer(environment);
								}).then((component) => {
									logger.debug('initialized', ci.name, 'component for run', run);

									return {
										name: ci.name,
										component: component
									};
								});
						})).then((items) => {
							return Object.assign(context, {
								components: items.reduce((map, item) => {
									map[item.name] = item.component;

									return map;
								}, { })
							});
						});
					}).then((context) => {
						const messages = context.messages;

						if (messages === null || messages === undefined) {
							logger.warn('aborting run', run, ', no messages to process');

							return context;
						}

						let messagesToProcess;

						if (Array.isArray(messages)) {
							messagesToProcess = messages;
						} else {
							messagesToProcess = [messages];
						}

						logger.info('processing', messagesToProcess.length, 'message(s) for run', run);

						return Promise.all(messagesToProcess.map((message, i) => {
							logger.info('processing message', (i + 1), 'for run', run);

							return messageProcessor.process(message, environment, context.components, logger);
						})).then((results) => {
							return Object.assign(context, { results: results });
						});
					}).then((context) => {
						const components = context.components;

						Object.getOwnPropertyNames(components).forEach((key) => {
							const component = components[key];

							if (is.fn(component.dispose)) {
								logger.debug('disposing', key, 'component for run', run);

								component.dispose();
							}
						});

						return context;
					}).then((context) => {
						logger.info('processing completed normally for run', run);

						return context.results;
					}).catch((e) => {
						logger.error('processing failed for run', run);
						logger.error(e);

						return null;
					}).then((results) => {
						let outputPromise;

						if (outputTransformer) {
							outputPromise = Promise.resolve()
								.then(() => {
									return outputTransformer(results);
								}).catch((e) => {
									logger.error('output transformer failed, no response will be provided to caller', e);

									return null;
								});
						} else {
							outputPromise = Promise.resolve(null);
						}

						return outputPromise;
					}).then((output) => {
						if (output !== null) {
							logger.info('signaling completion and returning output to caller', run);

							callback(null, output);
						} else {
							logger.info('signaling completion', run);

							callback();
						}

						const end = new Date();

						logger.info('finished run', run, 'after [', (end.getTime() - start.getTime()) ,'] milliseconds');
					});
			};
		}

		/**
		 * An extractor that returns the raw event, as passed to the AWS Lambda function
		 * (see {@link LambdaBuilder#usingMessageExtractor}).
		 *
		 * @public
		 * @returns {function(*)}
		 */
		static getEventExtractor() {
			return (event) => {
				return Promise.resolve([ event ]);
			};
		}

		/**
		 * An extractor that returns an array, containing one null item (see
		 * {@link LambdaBuilder#usingMessageExtractor}).
		 *
		 * @public
		 * @returns {function(*)}
		 */
		static getEmptyExtractor() {
			return (event) => {
				return Promise.resolve([ null ]);
			};
		}

		/**
		 * An extractor that returns an data passed to the AWS Lambda function
		 * via an SNS trigger (see {@link LambdaBuilder#usingMessageExtractor}).
		 *
		 * @public
		 * @returns {function(*)}
		 */
		static getSnsExtractor() {
			return (event) => {
				let recordsToProcess;

				if (event && Array.isArray(event.Records)) {
					recordsToProcess = event.Records.filter((r) => r && r.Sns && is.string(r.Sns.Message));
				} else {
					recordsToProcess = [ ];
				}

				return Promise.resolve(recordsToProcess.map((r) => JSON.parse(r.Sns.Message)));
			};
		}

		/**
		 * An initializer that generates a {@link HttpProvider} (see
		 * {@link LambdaBuilder#usingComponentInitializer}).
		 *
		 * @public
		 * @returns {function(*)}
		 */
		static getHttpInitializer() {
			return (environment) => {
				return environment.getConfiguration()
					.then((configuration) => {
						const http = new HttpProvider(configuration.http);

						return http.start().then(() => http);
					});
			};
		}

		/**
		 * An initializer that generates a {@link S3Provider} (see
		 * {@link LambdaBuilder#usingComponentInitializer}).
		 *
		 * @public
		 * @returns {function(*)}
		 */
		static getS3Initializer() {
			return (environment) => {
				return environment.getConfiguration()
					.then((configuration) => {
						if (!configuration || !configuration.aws || !configuration.aws.s3) {
							throw new Error('Configuration data for Amazon S3 is missing.');
						}

						const s3 = new S3Provider(configuration.aws.s3);

						return s3.start().then(() => s3);
					});
			};
		}

		/**
		 * An initializer that generates a {@link SesProvider} (see
		 * {@link LambdaBuilder#usingComponentInitializer}).
		 *
		 * @public
		 * @returns {function(*)}
		 */
		static getSesInitializer() {
			return (environment) => {
				return environment.getConfiguration()
					.then((configuration) => {
						if (!configuration || !configuration.aws || !configuration.aws.ses) {
							throw new Error('Configuration data for Amazon SES is missing.');
						}

						const ses = new SesProvider(configuration.aws.ses);

						return ses.start().then(() => ses);
					});
			};
		}

		/**
		 * An initializer that generates a {@link SnsProvider} (see
		 * {@link LambdaBuilder#usingComponentInitializer}).
		 *
		 * @public
		 * @returns {function(*)}
		 */
		static getSnsInitializer() {
			return (environment) => {
				return environment.getConfiguration()
					.then((configuration) => {
						if (!configuration || !configuration.aws || !configuration.aws.sns) {
							throw new Error('Configuration data for Amazon SNS is missing.');
						}

						const sns = new SnsProvider(configuration.aws.sns);

						return sns.start().then(() => sns);
					});
			};
		}

		/**
		 * An initializer that generates a {@link SqsProvider} (see
		 * {@link LambdaBuilder#usingComponentInitializer}).
		 *
		 * @public
		 * @returns {function(*)}
		 */
		static getSqsInitializer() {
			return (environment) => {
				return environment.getConfiguration()
					.then((configuration) => {
						if (!configuration || !configuration.aws || !configuration.aws.sqs) {
							throw new Error('Configuration data for Amazon SQS is missing.');
						}

						const sqs = new SqsProvider(configuration.aws.sqs);

						return sqs.start().then(() => sqs);
					});
			};
		}

		/**
		 * An initializer that generates a {@link TwilioProvider} (see
		 * {@link LambdaBuilder#usingComponentInitializer}).
		 *
		 * @public
		 * @returns {function(*)}
		 */
		static getTwilioInitializer() {
			return (environment) => {
				return environment.getConfiguration()
					.then((configuration) => {
						if (!configuration || !configuration.twilio) {
							throw new Error('Configuration data for Twilio is missing.');
						}

						const twilio = new TwilioProvider(configuration.twilio);

						return twilio.start().then(() => twilio);
					});
			};
		}

		static getEmptyProcessor() {
			return (message, environment, components, logger) => {
				logger.warn('Ignoring message');
			};
		}

		static getApiGatewayOutputTransformer() {
			return (results) => {
				let response;

				if (!is.array(results) || results.length !== 1 || is.null(results[0]) || is.undefined(results[0])) {
					logger.error('Input processing returned an unexpected result, unable to formulate HTTP response.');

					response = {
						statusCode: 500
					};
				} else {
					const result = results[0];

					let mimeType;
					let body;

					if (is.string(result)) {
						mimeType = 'text/csv';
						body = result;
					} else {
						mimeType = 'application/json';
						body = JSON.stringify(result);
					}

					response = {
						statusCode: 200,
						headers: {
							"Content-Type": mimeType,
							"Access-Control-Allow-Origin": "*"
						},
						body: body
					};
				}

				return response;
			};
		}

		static getEmptyOutputProcessor() {
			return (results) => {
				return Promise.resolve(null);
			};
		}

		static getSerializer() {
			return new Serializer();
		}

		toString() {
			return `[LambdaBuilder (name=${this._environment.getName()}, environment=${this._environment.getEnvironment()}]`;
		}
	}

	return LambdaBuilder;
})();