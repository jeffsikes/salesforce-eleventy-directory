// salesforce.js
const jsforce = require('jsforce');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
dotenv.config();

const conn = new jsforce.Connection({
    loginUrl: process.env.SF_LOGIN_URL
});

const loginToSalesforce = async () => {
    const userInfo = await conn.login(
        process.env.SF_USERNAME,
        process.env.SF_PASSWORD + process.env.SF_TOKEN
    );
    console.log("User ID: " + userInfo.id);
    console.log("Org ID: " + userInfo.organizationId);
    return userInfo;
};

// Download a profile photo using the authenticated session cookie
const downloadPhoto = async (photoUrl, userId) => {
    const imgDir = path.join(__dirname, 'src', 'img', 'profiles');
    fs.mkdirSync(imgDir, { recursive: true });

    const safeId = userId.replace(/[^a-zA-Z0-9]/g, '');
    const filePath = path.join(imgDir, `${safeId}.jpg`);

    // Use the authenticated session to fetch the image
    const response = await fetch(photoUrl, {
        headers: {
            'Authorization': `Bearer ${conn.accessToken}`
        },
        redirect: 'follow'
    });

    if (!response.ok) {
        console.warn(`Failed to download photo for ${userId}: ${response.status}`);
        return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    return `/img/profiles/${userId}.jpg`;
};

const searchUsers = async (authenticatedUserId) => {
    const result = await conn.query(
        'SELECT Id, FirstName, LastName, Email, SmallPhotoUrl FROM User WHERE IsActive = true LIMIT 100'
    );

    // Compare first 15 chars to handle 15 vs 18 char ID mismatch
    const authId15 = authenticatedUserId.substring(0, 15);

    // Download profile photos and flag the authenticated user
    for (const user of result.records) {
        user.isAuthenticatedUser = user.Id.substring(0, 15) === authId15;
        if (user.SmallPhotoUrl) {
            const localPath = await downloadPhoto(user.SmallPhotoUrl, user.Id);
            user.LocalPhotoUrl = localPath;
        }
    }

    return result.records;
};

module.exports = { loginToSalesforce, searchUsers };
