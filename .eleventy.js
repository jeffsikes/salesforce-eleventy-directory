const { loginToSalesforce, searchUsers } = require('./salesforce');
const dotenv = require('dotenv');

dotenv.config();

module.exports = function(eleventyConfig) {
    eleventyConfig.addGlobalData("env", {
        SF_LOGIN_URL: process.env.SF_LOGIN_URL
    });
    eleventyConfig.addPassthroughCopy("src/img");

    eleventyConfig.addCollection("salesforceUsers", async function(collectionApi) {
        const userInfo = await loginToSalesforce();
        const users = await searchUsers(userInfo.id);
        return users;
    });

    return {
        dir: {
            input: "src",
            output: "dist"
        }
    };
};
