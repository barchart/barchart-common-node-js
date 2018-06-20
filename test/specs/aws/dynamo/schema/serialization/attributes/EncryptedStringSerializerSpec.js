var Attribute = require('./../../../../../../../aws/dynamo/schema/definitions/Attribute'),
	EncryptionType = require('./../../../../../../../aws/dynamo/schema/definitions/EncryptionType'),
	Encryptor = require('./../../../../../../../aws/dynamo/schema/definitions/Encryptor'),
	DataType = require('./../../../../../../../aws/dynamo/schema/definitions/DataType');

var EncryptedStringSerializer = require('./../../../../../../../aws/dynamo/schema/serialization/attributes/EncryptedStringSerializer');

describe('When a EncryptedStringSerializer is instantiated using the AES-192 algorithm', function() {
	'use strict';

	var attribute;
	var serializer;

	beforeEach(function() {
		attribute = new Attribute('test', DataType.STRING, null, new Encryptor(EncryptionType.AES_192, 'this-is-a-simple-test'));
		serializer = new EncryptedStringSerializer(attribute);
	});

	describe('and a string is serialized', function() {
		var string = ('abc').repeat(1);
		var serialized;

		beforeEach(function() {
			serialized = serializer.serialize(string);
		});

		it('should produce an object with a binary (i.e. "B") property', function() {
			expect(serialized.hasOwnProperty("B")).toEqual(true);
		});

		it('should produce an object with a binary (i.e. buffer) value', function() {
			expect(Buffer.isBuffer(serialized.B)).toEqual(true);
		});

		describe('and the output is deserialized', function() {
			var deserialized;

			beforeEach(function() {
				deserialized = serializer.deserialize(serialized);
			});

			it('should produce the original string', function() {
				expect(deserialized).toEqual(string);
			});
		});
	});
});