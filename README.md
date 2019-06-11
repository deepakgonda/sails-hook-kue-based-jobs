# Sails Hooks For Jobs (Using Kue)
Sails Hook For Jobs Scheduling Based on Kue for sails v1.1.0+. It can be used for various purpose for example the operations which take time like sending mails. You can use this to create a Job for sending the mail which will be sent in the background.

# Dependencies
[**Redis**](https://redis.io/) (you need to install globally)

[**Kue**](https://automattic.github.io/kue/)

### Installation and Setup guide

- Step 1:
    npm i sails-hook-kue-based-jobs

- Step 2:
    sails lift

This will automatically create a config file in your api/config folder and `jobs` directory in the api folder with some demo job processors. You can customize and add your own if you want.

To schedule a job inside your controller/actions/helpers just follow the job scheduling example at [**Kue Docs**](https://github.com/Automattic/kue#creating-jobs) with only one change i.e you will get the `queue` object from sails global. For example: 

```js
var job = sails.queue.create('email', {
    title: 'welcome email for tj'
  , to: 'tj@learnboost.com'
  , template: 'welcome-email'
}).save( function(err){
   if( !err ) console.log( job.id );
});
```



