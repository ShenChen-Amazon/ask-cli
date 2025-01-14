const R = require('ramda');
const path = require('path');

const SmapiClient = require('@src/clients/smapi-client');
const ResourcesConfig = require('@src/model/resources-config');
const Manifest = require('@src/model/manifest');
const jsonView = require('@src/view/json-view');
const MultiTasksView = require('@src/view/multi-tasks-view');
const Messenger = require('@src/view/messenger');
const hashUtils = require('@src/utils/hash-utils');
const stringUtils = require('@src/utils/string-utils');
const CONSTANTS = require('@src/utils/constants');

const DeployDelegate = require('./deploy-delegate');

module.exports = class SkillInfrastructureController {
    constructor(configuration) {
        const { profile, doDebug } = configuration;
        this.profile = profile;
        this.doDebug = doDebug;
    }

    /**
     * Bootstrap a skill project with deploy delegate's custom logic, to initiate the project to be ready for deployment.
     * @param {String} workspacePath The path to the new skill's workspace
     * @param {Function} callback (error)
     */
    bootstrapInfrastructures(workspacePath, callback) {
        const infraType = ResourcesConfig.getInstance().getSkillInfraType(this.profile);
        if (!stringUtils.isNonBlankString(infraType)) {
            return process.nextTick(() => {
                callback('[Error]: Please set the "type" field for your skill infrastructures.');
            });
        }
        // 1.Prepare the loading of deploy delegate
        DeployDelegate.load(infraType, (loadErr, deployDelegate) => {
            if (loadErr) {
                return callback(loadErr);
            }
            // 2.Call bootstrap method from deploy delegate
            const bootstrapOptions = {
                profile: this.profile,
                userConfig: ResourcesConfig.getInstance().getSkillInfraUserConfig(this.profile),
                workspacePath
            };
            deployDelegate.bootstrap(bootstrapOptions, (bootsErr, bootstrapResult) => {
                if (bootsErr) {
                    return callback(bootsErr);
                }
                const { userConfig } = bootstrapResult;
                ResourcesConfig.getInstance().setSkillInfraUserConfig(this.profile, userConfig);
                callback();
            });
        });
    }

    /**
     * Entry method for skill infrastructure deployment based on the deploy delegate type.
     * @param {Function} callback
     */
    deployInfrastructure(callback) {
        const infraType = ResourcesConfig.getInstance().getSkillInfraType(this.profile);
        // 1.Prepare the loading of deploy delegate
        DeployDelegate.load(infraType, (loadErr, deployDelegate) => {
            if (loadErr) {
                return callback(loadErr);
            }
            // 2.Trigger regional deployment using deploy delegate
            this.deployInfraToAllRegions(deployDelegate, (deployErr, deployResult) => {
                if (deployErr) {
                    return callback(deployErr);
                }
                // 3.Post deploy skill manifest update
                this.updateSkillManifestWithDeployResult(deployResult, (postUpdateErr) => {
                    if (postUpdateErr) {
                        return callback(postUpdateErr);
                    }
                    callback();
                });
            });
        });
    }

    /**
     * Deploy skill infrastructure to all the Alexa regions.
     * @param {Object} dd DeployDelegate instance
     * @param {Function} callback (error, invokeResult)
     *                            invokeResult: { $region: { endpoint: { url }, lastDeployHash, deployState } }
     */
    deployInfraToAllRegions(dd, callback) {
        const skillName = stringUtils.filterNonAlphanumeric(Manifest.getInstance().getSkillName())
            || stringUtils.filterNonAlphanumeric(path.basename(process.cwd()));
        if (!stringUtils.isNonBlankString(skillName)) {
            return callback('[Error]: Failed to parse the skill name used to decide the CloudFormation stack name. '
                + 'Please make sure your skill name or skill project folder basename contains alphanumeric characters.');
        }
        const regionsList = Object.keys(ResourcesConfig.getInstance().getCode(this.profile));
        if (!regionsList || regionsList.length === 0) {
            return callback('[Warn]: Skip the infrastructure deployment, as the "code" field has not been set in the resources config file.');
        }

        // 1.instantiate MultiTasksView
        const taskConfig = {
            concurrent: true,
            exitOnError: false
        };
        const multiTasksView = new MultiTasksView(taskConfig);
        // 2.register each regional task into MultiTasksView
        regionsList.forEach((region) => {
            const taskTitle = `Deploy Alexa skill infrastructure for region "${region}"`;
            const taskHandle = (reporter, taskCallback) => {
                this._deployInfraByRegion(reporter, dd, region, skillName, taskCallback);
            };
            multiTasksView.loadTask(taskHandle, taskTitle, region);
        });
        // 3.start multi-tasks and validate task response
        multiTasksView.start((taskErr, taskResult) => {
            if (taskErr) {
                // update partial successful deploy results to resources config
                if (taskErr.partialResult && !R.isEmpty(R.keys(taskErr.partialResult))) {
                    this._updateResourcesConfig(taskErr.partialResult);
                }
                return callback(taskErr.error);
            }
            // 4.validate response and update states based on the results
            try {
                dd.validateDeployDelegateResponse(taskResult);
            } catch (responseInvalidErr) {
                return callback(responseInvalidErr);
            }
            this._updateResourcesConfig(taskResult);
            callback(null, taskResult);
        });
    }

    /**
     * Update the skill manifest based on the skill infrastructure deployment result.
     * @param {Object} rawDeployResult deploy result from invoke: { $region: { endpoint: { url }, lastDeployHash, deployState } }
     * @param {Function} callback (error)
     */
    updateSkillManifestWithDeployResult(rawDeployResult, callback) {
        // 1.update local skill.json file: update the "uri" in all the existing "apis" for each region
        R.keys(Manifest.getInstance().getApis()).forEach((domain) => {
            R.keys(rawDeployResult).forEach((region) => {
                Manifest.getInstance().setApisEndpointByDomainRegion(domain, region, rawDeployResult[region].endpoint);
            });
        });
        Manifest.getInstance().write();
        // 2.update skill manifest
        const smapiClient = new SmapiClient({ profile: this.profile, doDebug: this.doDebug });
        const skillId = ResourcesConfig.getInstance().getSkillId(this.profile);
        smapiClient.skill.manifest.updateManifest(skillId, CONSTANTS.SKILL.STAGE.DEVELOPMENT, Manifest.getInstance().content, null,
            (updateErr, updateResponse) => {
                if (updateErr) {
                    return callback(updateErr);
                }
                if (updateResponse.statusCode >= 300) {
                    return callback(jsonView.toString(updateResponse.body));
                }
                Messenger.getInstance().info('  The api endpoint of skill.json have been updated from the skill infrastructure deploy results.');
                callback();
            });
    }

    /**
     * Deploy skill infrastructure by calling invoke function from deploy delegate.
     * @param {Object} reporter upstream CLI status reporter
     * @param {Object} dd injected deploy delegate instance
     * @param {String} alexaRegion
     * @param {String} skillName
     * @param {Function} callback (error, invokeResult)
     *                   callback.error can be a String or { message, context } Object which passes back the partial deploy result
     */
    _deployInfraByRegion(reporter, dd, alexaRegion, skillName, callback) {
        const regionConfig = {
            profile: this.profile,
            alexaRegion,
            skillId: ResourcesConfig.getInstance().getSkillId(this.profile),
            skillName,
            code: {
                codeBuild: ResourcesConfig.getInstance().getCodeBuildByRegion(this.profile, alexaRegion).file,
                isCodeModified: null
            },
            userConfig: ResourcesConfig.getInstance().getSkillInfraUserConfig(this.profile),
            deployState: ResourcesConfig.getInstance().getSkillInfraDeployState(this.profile)
        };
        // 1.calculate the lastDeployHash for current code folder and compare with the one in record
        const lastDeployHash = ResourcesConfig.getInstance().getCodeLastDeployHashByRegion(this.profile, regionConfig.alexaRegion);
        hashUtils.getHash(regionConfig.code.codeBuild, (hashErr, currentHash) => {
            if (hashErr) {
                return callback(hashErr);
            }
            regionConfig.code.isCodeModified = currentHash !== lastDeployHash;
            // 2.trigger the invoke function from deploy delegate
            dd.invoke(reporter, regionConfig, (invokeErr, invokeResult) => {
                if (invokeErr) {
                    return callback(invokeErr);
                }
                const { deployState, message, reasons } = invokeResult;
                // track the current hash when deploy state contains s3 result
                if (deployState && deployState.s3) {
                    invokeResult.lastDeployHash = currentHash;
                }
                if (reasons) {
                    // when "reasons" exist, regional deployment fails and need to callback with an error object with message and the deploy context
                    const context = {
                        deployState: invokeResult.deployState,
                        lastDeployHash: invokeResult.lastDeployHash
                    };
                    callback({ message, context });
                } else {
                    callback(null, invokeResult);
                }
            });
        });
    }

    /**
     * Update the the ask resources config and the deploy state.
     * @param {Object} rawDeployResult deploy result from invoke: { $region: { endpoint: { url }, lastDeployHash, deployState } }
     */
    _updateResourcesConfig(rawDeployResult) {
        const newDeployState = {};
        R.keys(rawDeployResult).forEach((alexaRegion) => {
            newDeployState[alexaRegion] = rawDeployResult[alexaRegion].deployState;
            ResourcesConfig.getInstance().setCodeLastDeployHashByRegion(this.profile, alexaRegion, rawDeployResult[alexaRegion].lastDeployHash);
        });
        ResourcesConfig.getInstance().setSkillInfraDeployState(this.profile, newDeployState);
        ResourcesConfig.getInstance().write();
    }
};
