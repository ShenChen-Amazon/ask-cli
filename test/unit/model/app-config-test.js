const expect = require('chai').expect;
const sinon = require('sinon');
const path = require('path');
const fs = require('fs');
const jsonfile = require('jsonfile');

const AppConfig = require('@src/model/app-config');

describe('Model test - app config test', () => {
    const FIXTURE_PATH = path.join(process.cwd(), 'test', 'unit', 'fixture', 'model');
    const APP_CONFIG_PATH = path.join(FIXTURE_PATH, 'app-config.json');
    const YAML_APP_CONFIG_PATH = path.join(FIXTURE_PATH, 'app-config.yaml');

    describe('# inspect correctness for constructor, getInstance and dispose', () => {
        const NOT_EXISTING_PROJECT_CONFIG_PATH = path.join(FIXTURE_PATH, 'out-of-noWhere.json');
        const INVALID_JSON_PROJECT_CONFIG_PATH = path.join(FIXTURE_PATH, 'invalid-json.json');

        it('| initiate as a AppConfig class', () => {
            const appConfig = new AppConfig(APP_CONFIG_PATH);
            expect(appConfig).to.be.instanceof(AppConfig);
        });

        it('| make sure AppConfig class is singleton', () => {
            const config1 = new AppConfig(APP_CONFIG_PATH);
            const config2 = new AppConfig(APP_CONFIG_PATH);
            expect(config1 === config2);
        });

        it('| make sure YAML and JSON resources config can both be created well', () => {
            const yamlConfig = new AppConfig(YAML_APP_CONFIG_PATH);
            const jsonConfig = jsonfile.readFileSync(APP_CONFIG_PATH);
            expect(yamlConfig.content).deep.equal(jsonConfig);
        });

        it('| get instance function return the instance constructed before', () => {
            const appConfig = new AppConfig(APP_CONFIG_PATH);
            expect(AppConfig.getInstance() === appConfig).equal(true);
        });

        it('| dispose the instance correctly', () => {
            new AppConfig(APP_CONFIG_PATH);
            AppConfig.dispose();
            expect(AppConfig.getInstance()).equal(null);
        });

        it('| init with a file path not existing, expect correct error message thrown', () => {
            try {
                new AppConfig(NOT_EXISTING_PROJECT_CONFIG_PATH);
                throw new Error('No error caught but supposed to throw an error when new.');
            } catch (err) {
                const expectedError = `File ${NOT_EXISTING_PROJECT_CONFIG_PATH} not exists.`;
                expect(err).to.match(new RegExp(expectedError));
            }
        });

        it('| init with a file path without access permission, expect correct error message thrown', () => {
            // setup
            fs.chmodSync(APP_CONFIG_PATH, 0o111);
            try {
                // call
                new AppConfig(APP_CONFIG_PATH);
                throw new Error('No error caught but supposed to throw an error when new.');
            } catch (err) {
                // verify
                const expectedError = `No access to read/write file ${APP_CONFIG_PATH}.`;
                expect(err).to.match(new RegExp(expectedError));
            } finally {
                // clear
                fs.chmodSync(APP_CONFIG_PATH, 0o644);
            }
        });

        it('| init with a invalid json file, expect correct error message thrown', () => {
            try {
                new AppConfig(INVALID_JSON_PROJECT_CONFIG_PATH);
                throw new Error('No error caught but supposed to throw an error when new.');
            } catch (err) {
                const expectedError = `Failed to parse JSON file ${INVALID_JSON_PROJECT_CONFIG_PATH}.`;
                expect(err).to.match(new RegExp(expectedError));
            }
        });

        afterEach(() => {
            AppConfig.dispose();
        });
    });

    describe('# inspect getter and setter for each field', () => {
        const TEST_PROFILE = 'testProfile';

        beforeEach(() => {
            new AppConfig(APP_CONFIG_PATH);
        });

        [
            {
                field: 'AwsProfile',
                profile: TEST_PROFILE,
                newValue: "awsProfile new",
                oldValue: "awsProfile"
            },
            {
                field: 'Token',
                profile: TEST_PROFILE,
                newValue: "token new",
                oldValue: {
                    "access_token": "accessToken",
                    "refresh_token": "refreshToken",
                    "token_type": "bearer",
                    "expires_in": 3600,
                    "expires_at": "expiresAt"
                }
            },
            {
                field: 'VendorId',
                profile: TEST_PROFILE,
                newValue: "vendorId new",
                oldValue: "vendorId"
            }
        ].forEach(({
            field,
            profile,
            newValue,
            oldValue
        }) => {
            it(`test get${field} function successfully`, () => {
                expect(AppConfig.getInstance()[`get${field}`](profile)).deep.equal(oldValue);
            });

            it(`test set${field} function successfully`, () => {
                AppConfig.getInstance()[`set${field}`](profile, newValue);
                expect(AppConfig.getInstance()[`get${field}`](profile)).equal(newValue);
            });
        });

        afterEach(() => {
            AppConfig.dispose();
        });
    });
});
