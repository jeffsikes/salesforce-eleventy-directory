// salesforce.js
const jsforce = require('jsforce');
const dotenv = require('dotenv');

dotenv.config();

const conn = new jsforce.Connection({
    loginUrl: process.env.SF_LOGIN_URL
});

const loginToSalesforce = () => {
    return conn.login(process.env.SF_USERNAME, process.env.SF_PASSWORD + process.env.SF_TOKEN, (err, userInfo) => {
        if (err) {
            return console.error(err);
        }
        console.log("User ID: " + userInfo.id);
        console.log("Org ID: " + userInfo.organizationId);
    });
};

const searchUsers = (lastNameInitial) => {
    return new Promise((resolve, reject) => {
        conn.query(`
            SELECT Id, FirstName, LastName, Email, SmallPhotoUrl FROM User LIMIT 100`, 
        (err, result) => {
            if (err) {
                reject(err);
            }
            resolve(result.records);
        });
    });
};

module.exports = { loginToSalesforce, searchUsers };
