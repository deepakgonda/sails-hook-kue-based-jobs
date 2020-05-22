# Sails Hooks For Jobs (Using Kue)
Sails Hook For Jobs Scheduling Based on Kue for sails v1.1.0+. It can be used for various purpose for example the operations which take time like sending mails. You can use this to create a Job for sending the mail which will be sent in the background.

# Dependencies

[**Redis**](https://redis.io/) (you need to install globally)

[**Kue**](https://automattic.github.io/kue/)

### Installation and Setup guide

* Step 1:

    npm i sails-hook-kue-based-jobs

* Step 2:

    sails lift

This will automatically create a config file with name `kue-jobs.js` in your api/config folder and `jobs` directory in the api folder with some demo job processors. You can customize and add your own if you want.

To schedule a job inside your controller/actions/helpers just follow the job scheduling example at [**Kue Docs**](https://github.com/Automattic/kue#creating-jobs) with only one change i.e you will get the `queue` object from sails global. For example: 

``` js
var job = sails.queue.create('emailJob', {
    title: 'welcome email for tj',
    to: 'tj@learnboost.com',
    template: 'welcome-email'
}).save(function(err) {
    if (!err) console.log(job.id);
});
```

As there might be situation in which you want to get the job info and status by job id. You can get it simply as:

``` js
sails.job.get(jobId, (err, job) => {
    if (err) {
        return err;
    }

    console.log(job);
});
```

### Config Options and their description

When you install this hook in your sails project, it first start it detects if configuration file is present in your sails config directory or not, if not, then it will create config file with default options, which can be edited later. Options are:

* `redisUrl` :

    This is url used to connect with redis, if this is not provided default value `redis://127.0.0.1:6379` will be used.

* `enableApi` :

    When this is true, a small web app is started on port 3000, where you can check status of Jobs

* `apiPort` :

    You can specify different for the web app.

* `onlyStartOnWorkers` :

    This will make kue jobs processors start on only those node process, which have `workerEnvName` set to true

* `workerEnvName` :

    This is ENV name which should be present on workers. By default it is `IS_WORKER` 


* `markStuckJobAsFailPeriod` :

    Time in milliseconds after the active job which is somehow stuck will be marked as failed.     
