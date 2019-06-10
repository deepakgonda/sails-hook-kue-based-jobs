module.exports.demoJob = function (job, cb) {
    sails.log.info("Job, demo-job is done =>", job.data.myParamKey);
    cb();
};