import * as assert from 'assert';

import * as json from '../../json';


suite('Extension Test Suite', () => {
	const jsonSample1 = `
// It is sample snippet!
"Print to console": {	// this is /* snippet name */
"prefix" /* prefix means "trigger" */ :"log",
	"body": [
		"// output to console"
		"console.log('$1');",
		"\${2:/*here*/}"
	],

	"description": "Log output to console",	/* oops! */
}
/***********/	/////////////////
/* COMMENT */   ///  comment  ///
/***********/   /////////////////
, // ???
`

	test('JSON parse test', () => {
		assert.notStrictEqual(json.parseJson(jsonSample1), undefined);
	});
});

