const { loginToSalesforce, searchUsers } = require('./salesforce');
const dotenv = require('dotenv');

dotenv.config();

module.exports = function(eleventyConfig) {
    eleventyConfig.addGlobalData("env", process.env);

    eleventyConfig.addCollection("salesforceUsers", async function(collectionApi) {
        await loginToSalesforce();
        const users = await searchUsers('S');
        return users;
    });

    return {
        dir: {
            input: "src",
            output: "dist"
        }
    };
};
