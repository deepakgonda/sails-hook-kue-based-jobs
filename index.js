/**
 * kue-based-jobs hook
 *
 * @docs    :: https://sailsjs.com/docs/concepts/extending-sails/hooks
 */

module.exports = function kueJobs(sails) {

    const kue = require("kue");
    const fs = require('fs-extra')
    const Job = kue.Job;
    const redis = require("redis");


    /**
    * Build the hook definition.
    * (this is returned below)
    *
    * @type {Dictionary}
    */
    return {

        defaults: {
            kueJobs: {
                redisUrl: 'redis://127.0.0.1:6379'
            },

            Jobs: {}
        },

        configure: async function () {
            // Check if configuration file is present, otherwise copy it
            try {
                const configFilePath = '../../config/kue-jobs.js';
                const exists = await fs.pathExists(configFilePath);
                if (!exists) {
                    await fs.copy('./resources/config/kue-jobs.js', configFilePath);
                    sails.log.debug('[Sails Hook][kueJobs] : Success Adding the configuration file.');
                } else {
                    sails.log.debug('[Sails Hook][kueJobs] : Configuration file already present.');
                }
            } catch (err) {
                sails.log.error(err)
            }

            // Check if Jobs directory is present inside Api folder..., otherwise create it, and copy demo jobs
            try {
                const jobsDirPath = '../../api/jobs';
                const exists = await fs.pathExists(jobsDirPath);
                if (!exists) {
                    await fs.copy('./resources/jobs', jobsDirPath);
                    sails.log.debug('[Sails Hook][kueJobs] : Success copying jobs directory.');
                } else {
                    sails.log.debug('[Sails Hook][kueJobs] : jobs directory already present.');
                }
            } catch (err) {
                sails.log.error(err)
            }

            sails.log.info('[Sails Hook][kueJobs]: Configuration Check Finished');

        },

        initialize: async function () {

            let waitForHooksToBeLoaded = [];
            if (sails.hooks.orm) {
                waitForHooksToBeLoaded.push('hook:orm:loaded');
            }

            if (sails.hooks.pubsub) {
                waitForHooksToBeLoaded.push('hook:pubsub:loaded');
            }

            if (sails.hooks.helpers) {
                waitForHooksToBeLoaded.push('hook:helpers:loaded');
            }

            sails.after(waitForHooksToBeLoaded, function () {
                loadHook();
                sails.log.info('[Sails Hook][kueJobs]: Initializing');
            });
        }
    };


    function loadHook() {
        kue.redis.createClient = function () {
            var url = sails.config.kueJobs.redisUrl;
            sails.log.debug('[Sails Hook][kueJobs] : Redis Url: ');
            var client = redis.createClient(url, options);
            // Log client errors
            client.on("error", function (err) {
                sails.log.error(err);
            });

            return client;
        };

        // Import Job processors from sails Job Directory
        const jobProcessors = sails.config.Jobs;
        sails.log.debug('[Sails Hook][kueJobs] jobProcessors: ', jobProcessors);

        // Create job queue on Jobs service
        Jobs = kue.createQueue();
        Jobs._processors = jobProcessors;
        startWorker();
    }

    function startWorker() {
        logJobs();
        startProcessors();
    };

    function startProcessors() {
        if (Jobs._processors && Array.isArray(Jobs._processors)) {
            Jobs._processors.forEach(job => {
                Jobs.process(job, Jobs._processors[job]);
            });
        } else {
            sails.log.debug('[Sails Hook][kueJobs] jobProcessors aren\'t array or is undefined.');
        }
    };

    function logJobs() {
        Jobs.on("job enqueue", function (id) {
            Job.get(id, function (err, job) {
                if (err) return;
                sails.log.info("Job '" + job.type + "' (ID: " + id + ") Queued.", JSON.stringify(job.data));
            });
        }).on("job complete", function (id) {
            Job.get(id, function (err, job) {
                if (err) return;
                sails.log.info("Job '" + job.type + "' (ID: " + id + ") completed successfully.", JSON.stringify(job.data));
            });
        }).on("job failed", function (id) {
            Job.get(id, function (err, job) {
                if (err) return;
                sails.log(job._error);
                sails.log("\n");
                sails.log.warn("Job '" + job.type + "' (ID: " + id + ") failed. Error: " + job._error);
            });
        });
    };

};