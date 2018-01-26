const assert = require('@barchart/common-js/lang/assert');

const CompressedJsonSerializer = require('./CompressedJsonSerializer');

module.exports = (() => {
	'use strict';

	/**
	 * Converts an object into (and back from) the compressed and encrypted
	 * representation used on a DynamoDB record.
	 *
	 * @public
	 * @extends {CompressedJsonSerializer}
	 */
	class EncryptedJsonSerializer extends CompressedJsonSerializer {
		constructor(attribute) {
			super(attribute);
		}

		_getEncryptor() {
			return this._getAttribute().encryptor;
		}

		toString() {
			return '[EncryptedJsonSerializer]';
		}
	}

	return EncryptedJsonSerializer;
})();