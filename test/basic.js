var Sails = require('sails').Sails;

describe('Sails Basic tests ::', function () {

    // Var to hold a running sails app instance
    var sails;

    // Before running any tests, attempt to lift Sails
    before(() => {

        // Hook will timeout in 10 seconds
        this.timeout(11000);

        // Attempt to lift sails
        Sails().lift({
            hooks: {
                // Load the hook
                "kue-based-jobs": require('../'),
                // Skip grunt (unless your hook uses it)
                "grunt": false
            },
            log: { level: "error" }
        }, function (err, _sails) {
            if (err) return err;
            sails = _sails;
            return;
        });
    });

    // After tests are complete, lower Sails
    after(() => {

        // Lower Sails (if it successfully lifted)
        if (sails) {
            sails.lower(
                (err) => {
                    if (err) {
                        return console.log("Error occurred lowering Sails app: ", err);
                    }
                    console.log("Sails app lowered successfully!");
                });
        }
        // Otherwise just return
        return;
    });

    // Test that Sails can lift with the hook in place
    it('sails does not crash', () => {
        return true;
    });

});