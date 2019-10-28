import * as assert from 'assert';

import * as json from '../../json';

suite('Extension Test Suite', () => {
	const jsonSample1: string = `
// It is sample snippet!
{"Print to console": {	// this is /* snippet name */
"prefix" /* prefix means "trigger" */ :"log",
	"body": [
		"// output to console",
/*====*/"console.log('$1');",`
		+ '		"${2:/*here*/}",' +	// 「${x:...}」が「``」に入らないため、シングルクォート
		`	],

	"description": "Log output to console",	/* oops! */
}
/***********/	/////////////////
/* COMMENT */   ///  comment  ///
/***********/   /////////////////
, // ???
}
`

	test('JSON parse test1', () => {
		assert.notStrictEqual(json.parseJson(jsonSample1), undefined);
	});
});

