const sinon = require('sinon');
const { expect } = require('chai');

const stringUtils = require('@src/utils/string-utils');

describe('Utils test - string utility', () => {
    describe('# test function isNonEmptyString', () => {
        [
            {
                testCase: 'input is an object',
                str: {},
                expectation: false
            },
            {
                testCase: 'input is an array',
                str: [1, 2, 3],
                expectation: false
            },
            {
                testCase: 'input is a boolean',
                str: true,
                expectation: false
            },
            {
                testCase: 'input is an empty string',
                str: '',
                expectation: false
            },
            {
                testCase: 'input is a blank string',
                str: '      ',
                expectation: true
            },
            {
                testCase: 'input is a string with actual content',
                str: ' test string ',
                expectation: true
            },
        ].forEach(({ testCase, str, expectation }) => {
            it(`| ${testCase}, expect isNonEmptyString ${expectation}`, () => {
                // call
                const callResult = stringUtils.isNonEmptyString(str);
                // verify
                expect(callResult).equal(expectation);
            });
        });
    });

    describe('# test function isNonBlankString', () => {
        [
            {
                testCase: 'input is an object',
                str: {},
                expectation: false
            },
            {
                testCase: 'input is an array',
                str: [1, 2, 3],
                expectation: false
            },
            {
                testCase: 'input is a boolean',
                str: true,
                expectation: false
            },
            {
                testCase: 'input is an empty string',
                str: '',
                expectation: false
            },
            {
                testCase: 'input is a blank string',
                str: '      ',
                expectation: false
            },
            {
                testCase: 'input is a string with actual content',
                str: ' test string ',
                expectation: true
            },
        ].forEach(({ testCase, str, expectation }) => {
            it(`| ${testCase}, expect isNonBlankString ${expectation}`, () => {
                // call
                const callResult = stringUtils.isNonBlankString(str);
                // verify
                expect(callResult).equal(expectation);
            });
        });
    });

    describe('# test function isLambdaFunctionName', () => {
        [
            {
                testCase: 'input url string is null',
                str: null,
                expectation: false
            },
            {
                testCase: 'input url string is undefined',
                str: undefined,
                expectation: false
            },
            {
                testCase: 'input url string is empty',
                str: '',
                expectation: false
            },
            {
                testCase: 'input url string is blank',
                str: '        ',
                expectation: false
            },
            {
                testCase: 'input url string is valid function name',
                str: 'ask-custom-cityGuide-default',
                expectation: true
            },
            {
                testCase: 'input url string is http',
                str: 'http://lambda.arn.com',
                expectation: false
            },
            {
                testCase: 'input url string is https',
                str: 'https://test.com',
                expectation: false
            },
            {
                testCase: 'input url is random string',
                str: 'abc:A:<http://lambda>/invoke',
                expectation: false
            }

        ].forEach(({ testCase, str, expectation }) => {
            it(`| ${testCase}, expect isLambdaFunctionName ${expectation}`, () => {
                // call
                const callResult = stringUtils.isLambdaFunctionName(str);
                // verify
                expect(callResult).equal(expectation);
            });
        });
    });

    describe('# test function filterNonAlphanumeric', () => {
        [
            {
                testCase: 'input string is null',
                str: null,
                expectation: null
            },
            {
                testCase: 'input string is undefined',
                str: undefined,
                expectation: undefined
            },
            {
                testCase: 'input string is empty',
                str: '',
                expectation: ''
            },
            {
                testCase: 'input string is blank',
                str: '        ',
                expectation: ''
            },
            {
                testCase: 'input string is with non alphanumeric characters',
                str: 'default-!!!???09',
                expectation: 'default-09'
            },
            {
                testCase: 'input string is with non alphanumeric characters test 2',
                str: 'http://lambda.arn.com',
                expectation: 'httplambdaarncom'
            },
            {
                testCase: 'input string is all consisted of non alphanumeric characters',
                str: '://!@#$%^&*()<>?_',
                expectation: ''
            },
            {
                testCase: 'input string includes non-latin character',
                str: '中文 にほんご',
                expectation: ''
            }

        ].forEach(({ testCase, str, expectation }) => {
            it(`| ${testCase}, expect isLambdaFunctionName ${expectation}`, () => {
                // call
                const callResult = stringUtils.filterNonAlphanumeric(str);
                // verify
                expect(callResult).equal(expectation);
            });
        });
    });

    it('| inspect correctness of generateTimeStamp function', () => {
        sinon.useFakeTimers(new Date(2016, 2, 15));
        expect(stringUtils.generateTimeStamp()).equal('20160315070000000');
        sinon.restore();
    });

    describe('# test function splitStringFilterAndMapTo', () => {
        [
            {
                testCase: 'input string is empty',
                str: '',
                delimiter: '/n',
                filterBy: null,
                mapper: null,
                expectation: []
            },
            {
                testCase: 'input string is null',
                str: null,
                delimiter: '/n',
                filterBy: null,
                mapper: null,
                expectation: []
            },
            {
                testCase: 'input string is valid',
                str: 'abc,xyz',
                delimiter: ',',
                filterBy: null,
                mapper: null,
                expectation: ['abc', 'xyz']
            },
            {
                testCase: 'filterBy is not provided',
                str: 'abc,xyz',
                delimiter: ',',
                filterBy: null,
                mapper: item => item.toUpperCase(),
                expectation: ['ABC', 'XYZ']
            },
            {
                testCase: 'mapper is not provided',
                str: 'abc,xyz',
                delimiter: ',',
                filterBy: item => item !== 'xyz',
                mapper: null,
                expectation: ['abc']
            },
            {
                testCase: 'all parameters are valid',
                str: 'abc,xyz',
                delimiter: ',',
                filterBy: item => item !== 'xyz',
                mapper: item => item.toUpperCase(),
                expectation: ['ABC']
            }
        ].forEach(({ testCase, str, delimiter, filterBy, mapper, expectation }) => {
            it(`| ${testCase}, expect splitStringFilterAndMapTo returns ${expectation}`, () => {
                // call
                const callResult = stringUtils.splitStringFilterAndMapTo(str, delimiter, filterBy, mapper);
                // verify
                expect(JSON.stringify(callResult)).equal(JSON.stringify(expectation));
            });
        });
    });
});
