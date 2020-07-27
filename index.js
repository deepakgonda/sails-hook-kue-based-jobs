/**
* kue-based-jobs hook
*
* @docs :: https://sailsjs.com/docs/concepts/extending-sails/hooks
*/

module.exports = function kueJobs(sails) {

    const kue = require("kue");
    const fs = require('fs-extra');
    const Job = kue.Job;
    const path = require('path');

    let Queue = null;

    let shouldStartKueJobsOnThisProcess = false;
    let isMasterProcess = false;


    /**
    * Build the hook definition.
    * (this is returned below)
    *
    * @type {Dictionary}
    */
    return {

        defaults: {
            kueJobs: {
                redisUrl: 'redis://127.0.0.1:6379',
                enableApi: false,
                apiPort: 3000,
                webApiEnvName: 'IS_MASTER',
                onlyStartOnWorkers: false,
                workerEnvName: 'IS_WORKER',
                jobListenerIntervals: 5 * 60 * 1000,
                markStuckJobAsFailPeriod: 5 * 60 * 1000,
                removeCompleteJobPeriod: 24 * 60 * 1000,
            },
        },

        configure: async function () {
            let onlyStartOnWorkers = sails.config.kueJobs.onlyStartOnWorkers;
            if (onlyStartOnWorkers) {
                sails.log.info('[Sails Hook][kueJobs] : Set to run only for process which have worker env variable set to true.');
                let isWorker = process.env[sails.config.kueJobs.workerEnvName];
                sails.log.debug('[Sails Hook][kueJobs] : Is Worker:', isWorker);
                if (isWorker == 'true') {
                    shouldStartKueJobsOnThisProcess = true;
                }
            } else {
                shouldStartKueJobsOnThisProcess = true;
            }

            let isMaster = process.env[sails.config.kueJobs.webApiEnvName];
            sails.log.debug('[Sails Hook][kueJobs] : Is Master:', isMaster);
            if (isMaster == 'true') {
                isMasterProcess = true;
            }
            sails.log.debug('[Sails Hook][kueJobs] : Is Master Process:', isMasterProcess);
            // sails.log.debug('[Sails Hook][kueJobs] : shouldStartKueJobsOnThisProcess (as worker) :', shouldStartKueJobsOnThisProcess);

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

            // Check if configuration file is present, otherwise copy it
            try {
                const configFilePath = path.join(__dirname, '../../config/kue-jobs.js');
                const exists = await fs.pathExists(configFilePath);
                if (!exists) {
                    await fs.copy(path.join(__dirname, 'resources/config/kue-jobs.js'), configFilePath);
                    sails.log.info('[Sails Hook][kueJobs] : Success Adding the configuration file.');
                } else {
                    sails.log.info('[Sails Hook][kueJobs] : Configuration file already present.');
                }
            } catch (err) {
                sails.log.error(err);
            }

            // Check if Jobs directory is present inside Api folder..., otherwise create it, and copy demo jobs
            try {
                const jobsDirPath = path.join(__dirname, '../../api/jobs');
                const exists = await fs.pathExists(jobsDirPath);
                if (!exists) {
                    await fs.copy(path.join(__dirname, 'resources/jobs'), jobsDirPath);
                    sails.log.info('[Sails Hook][kueJobs] : Success copying jobs directory.');
                } else {
                    sails.log.info('[Sails Hook][kueJobs] : jobs directory already present.');
                }
            } catch (err) {
                sails.log.error(err);
            }
            // sails.log.info('[Sails Hook][kueJobs]: Configuration Check Finished');

            sails.after(waitForHooksToBeLoaded, function () {
                loadHook();
                sails.log.info('[Sails Hook][kueJobs]: Initializing');
            });
        }
    };


    function loadHook() {

        try {
            // Import Job processors from sails Job Directory
            const jobProcessors = require('require-all')({
                dirname: path.join(__dirname, '../../api/jobs'),
                filter: /(.+(-[j]|[J])ob)\.js$/,
                excludeDirs: /^\.(git|svn)$/,
                recursive: true,
                map: function (name, path) {
                    return name.replace(/-([a-z])/g, function (m, c) {
                        return c.toUpperCase();
                    });
                }
            });

            sails.log.info('[Sails Hook][kueJobs] jobProcessors: ', jobProcessors);

            let redisUrl = sails.config.kueJobs.redisUrl;
            sails.log.info('[Sails Hook][kueJobs] : Redis Url: ', redisUrl);
            // Create job queue on Jobs service
            Queue = kue.createQueue({
                redis: redisUrl
            });

            // Exposing the Queue Object with sails global
            sails.queue = Queue; // can be used as
            sails.job = Job; // can be used as 

            Queue._processors = Object.entries(jobProcessors); // Setting job processors on Queue as array
            startWorker();

            if (isMasterProcess) {
                logJobs();
                startWebUi();
                watchStuckJobsInActiveState();
                removeCompletedJobAfterSomeTime();
            }
            sails.log.info('[Sails Hook][kueJobs]: Initialized Successfully');

        } catch (err) {
            sails.log.error('[Sails Hook][kueJobs] : Error in loading Hook', err);
        }

    }


    function startWorker() {
        if (shouldStartKueJobsOnThisProcess) {
            startProcessors();
        } else {
            sails.log.debug('[Sails Hook][kueJobs]: Not Initiating Job Processors b/c it is not a worker process.');
        }
    }


    function startWebUi() {
        if (sails.config.kueJobs.enableApi) {

            const tcpPortUsed = require('tcp-port-used');

            tcpPortUsed.check(sails.config.kueJobs.apiPort, '127.0.0.1')
                .then((inUse) => {
                    if (inUse) {
                        sails.log.debug(`[Sails Hook][kueJobs]: Port ${sails.config.kueJobs.apiPort} is already in use: ` + inUse);
                    } else {
                        kue.app.listen(sails.config.kueJobs.apiPort);
                        kue.app.set('title', '[Sails Hook][kueJobs] - Queue Management');
                        sails.log.debug(`[Sails Hook][kueJobs]: Initialized Web API Interface on port ${sails.config.kueJobs.apiPort}`);
                    }
                }, (err) => {
                    sails.log.info('[Sails Hook][kueJobs]:', err.message);
                });
        }
    }


    function startProcessors() {

        if (Queue._processors && Array.isArray(Queue._processors)) {
            Queue._processors.forEach(job => {
                sails.log.debug(`[Sails Hook][kueJobs] Adding jobProcessor: Name: ${job[0]}`);
                Queue.process(job[0], job[1]);
            });
        } else {
            sails.log.debug('[Sails Hook][kueJobs] jobProcessors aren\'t array or is undefined.');
        }

    }


    function logJobs() {
        Queue.on("job enqueue", function (id) {
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
    }


    function watchStuckJobsInActiveState() {

        sails.log.debug('[Sails Hook][kueJobs]: watchStuckJobsInActiveState: Setting Up Listener');

        setInterval(async () => {

            // first check the active job list (hopefully this is relatively small and cheap)
            // if this takes longer than a single "interval" then we should consider using
            // setTimeouts
            let activeJobIds = await new Promise((resolve, reject) => {
                sails.queue.active((err, ids) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(ids);
                });
            });
            sails.log.info('[Sails Hook][kueJobs]: watchStuckJobsInActiveState: Active Jobs:', activeJobIds);

            if (activeJobIds && activeJobIds.length) {

                const Parallel = require('async-parallel');
                await Parallel.map(activeJobIds, async id => {

                    let job = await new Promise((resolve, reject) => {
                        sails.job.get(id, (err, job) => {
                            if (err) {
                                reject(err);
                            }

                            resolve(job);
                        });
                    });

                    var lastUpdate = + Date.now() - job.updated_at;
                    if (lastUpdate > sails.config.kueJobs.markStuckJobAsFailPeriod) {
                        sails.log.debug('[Sails Hook][kueJobs] : Job: ' + job.id + ', ' + job.type + ' , has\`t been updated in ' + lastUpdate + ' , It was Last Updated at ' + job.updated_at + ' and it is stuck active state');
                        job.state('failed').save();
                        // rescheduleJob(job, cb);  // either reschedule (re-attempt?) or remove the job.
                    }
                });

            }

        }, sails.config.kueJobs.jobListenerIntervals);
    }


    function removeCompletedJobAfterSomeTime() {

        sails.log.debug('[Sails Hook][kueJobs]: removeCompletedJobAfterSomeTime: Setting Up Listener');

        setInterval(async () => {

            let completeJobIds = await new Promise((resolve, reject) => {
                sails.queue.complete((err, ids) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(ids);
                });
            });
            sails.log.debug('[Sails Hook][kueJobs]: removeCompletedJobAfterSomeTime: Completed Jobs Total:', completeJobIds.length);

            if (completeJobIds.length > 101) {
                completeJobIds = completeJobIds.slice(1, 100);
            }

            if (completeJobIds && completeJobIds.length) {

                const Parallel = require('async-parallel');
                await Parallel.map(completeJobIds, async id => {

                    let job = await new Promise((resolve, reject) => {
                        sails.job.get(id, (err, job) => {
                            if (err) {
                                reject(err);
                            }

                            resolve(job);
                        });
                    });

                    let lastUpdate = + Date.now() - job.updated_at;
                    if (lastUpdate > sails.config.kueJobs.removeCompleteJobPeriod) {
                        sails.log.debug('[Sails Hook][kueJobs] : Job: ' + job.id + ', ' + job.type + ' , is completed at : ' + lastUpdate + ', Now we should remove it...');
                        job.remove();
                    }
                });

            }

        }, sails.config.kueJobs.jobListenerIntervals);
    }

};