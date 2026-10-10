// salesforce.js
const fs = require('fs');
const path = require('path');
try { process.loadEnvFile(); } catch { /* no .env file, use real environment */ }

// Session state set by loginToSalesforce
const session = { accessToken: null, instanceUrl: null, apiVersion: null };

// OAuth 2.0 client credentials flow (Connected App / External Client App)
const loginToSalesforce = async () => {
    const response = await fetch(`${process.env.SF_LOGIN_URL}/services/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: process.env.SF_CLIENT_ID,
            client_secret: process.env.SF_CLIENT_SECRET
        })
    });
    if (!response.ok) {
        throw new Error(`Salesforce login failed: ${response.status} ${await response.text()}`);
    }
    const token = await response.json();
    session.accessToken = token.access_token;
    session.instanceUrl = token.instance_url;

    // Use the newest REST API version the org supports
    const versions = await sfGet('/services/data');
    session.apiVersion = 'v' + versions[versions.length - 1].version;

    // The identity URL ends in /{orgId}/{userId}
    const [orgId, userId] = token.id.split('/').slice(-2);
    console.log("User ID: " + userId);
    console.log("Org ID: " + orgId);
    return { id: userId, organizationId: orgId };
};

const sfGet = async (pathAndQuery) => {
    const response = await fetch(`${session.instanceUrl}${pathAndQuery}`, {
        headers: { 'Authorization': `Bearer ${session.accessToken}` }
    });
    if (!response.ok) {
        throw new Error(`Salesforce request failed: ${response.status} ${await response.text()}`);
    }
    return response.json();
};

const query = async (soql) => {
    let result = await sfGet(`/services/data/${session.apiVersion}/query?q=${encodeURIComponent(soql)}`);
    const records = [...result.records];
    while (!result.done) {
        result = await sfGet(result.nextRecordsUrl);
        records.push(...result.records);
    }
    return records;
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
            'Authorization': `Bearer ${session.accessToken}`
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
    const records = await query(
        'SELECT Id, FirstName, LastName, Email, SmallPhotoUrl FROM User WHERE IsActive = true LIMIT 100'
    );

    // Compare first 15 chars to handle 15 vs 18 char ID mismatch
    const authId15 = authenticatedUserId.substring(0, 15);

    // Download profile photos and flag the authenticated user
    for (const user of records) {
        user.isAuthenticatedUser = user.Id.substring(0, 15) === authId15;
        if (user.SmallPhotoUrl) {
            const localPath = await downloadPhoto(user.SmallPhotoUrl, user.Id);
            user.LocalPhotoUrl = localPath;
        }
    }

    return records;
};

module.exports = { loginToSalesforce, searchUsers };
