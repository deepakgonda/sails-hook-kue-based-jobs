module.exports = function (job, done) {
    sails.log.info('Job, demo-job is done =>', job.data.myParamKey);
    done();
};