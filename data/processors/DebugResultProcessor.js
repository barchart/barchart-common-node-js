const log4js = require('log4js');

const attributes = require('common/lang/attributes'),
	is = require('common/lang/is');

const ResultProcessor = require('./../ResultProcessor');

module.exports = (() => {
	'use strict';

	const logger = log4js.getLogger('data/processors/DebugResultProcessor');
	
	class DebugResultProcessor extends ResultProcessor {
		constructor(configuration) {
			super(configuration);
		}

		_process(results) {
			if (results) {
				logger.info(JSON.stringify(results, null, 2));
			}

			return results;
		}

		toString() {
			return '[DebugResultProcessor]';
		}
	}

	return DebugResultProcessor;
})();