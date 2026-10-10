# Eleventy Experiment: Salesforce User Directory
This is a simple experiment to see if I can use Eleventy to generate a small user directory from a Salesforce SOQL query.

I'm using plain `fetch` and the Salesforce REST API to log in and run a SOQL query to get a list of users. I'm then using Eleventy to generate a static site with the user data.

> This project used to use JSForce. I replaced it with `fetch` and an OAuth client credentials login, which cut the install from about 236 packages to about 130.

Obviously not a real-world use case, but it's a fun experiment to see how Eleventy can be used to generate static sites from Salesforce data.

## Project Setup
I wanted to keep things simple, so I'm using very limited dependencies. Here's what you need to get started:

1. Install [Node.js](https://nodejs.org/) 20.12 or newer (it has built-in `.env` loading, so no dotenv needed)
2. Clone this repo and run `npm install`. That pulls in [Eleventy](https://www.11ty.dev/), which is the only dependency.

I decided against using a CSS framework for simplicity. If I did use one, tho, for these little lab experiments I'd probably use [Pico.css](https://picocss.com/).

## Salesforce Setup
You'll need some information from your Salesforce instance to get started.

| Required Fields | Description |
|-----------------|-------------|
|Salesforce URL | The URL for your Salesforce instance. For example, `https://mycompany.my.salesforce.com`. |
|Salesforce Client ID | The Consumer Key from an External Client App you create (steps below). |
|Salesforce Client Secret | The Consumer Secret from the same app. |

### Creating an External Client App
Salesforce no longer lets you create new Connected Apps, so this uses an External Client App with the OAuth client credentials flow. No password or security token needed.

1. In Setup, open App Manager and click **New External Client App**. Give it a name, a contact email, and set distribution state to **Local**.
2. Under **API (Enable OAuth Settings)**, check **Enable OAuth**, and use `https://localhost` as the callback URL (required by the form, never used).
3. Add the **Manage user data via APIs (api)** scope.
4. Check **Enable Client Credentials Flow** and accept the warning. Create the app.
5. On the app's **Policies** tab, edit the OAuth policies, enable the client credentials flow, and set **Run As** to the user the app should act as. That user needs API access and permission to read User records. For production, use a dedicated integration user.
6. On the **Settings** tab, open OAuth Settings and click **Consumer Key and Secret**. Salesforce may email you a verification code first.

The app can take a few minutes to start working after you create it.

Your URL, client ID and client secret go in a `.env` file in the root of the project. The URL needs to be your My Domain URL with no trailing slash, since the client credentials flow doesn't work against `login.salesforce.com`. Here's what mine looks like:

```
SF_LOGIN_URL={your My Domain URL}
SF_CLIENT_ID={your consumer key}
SF_CLIENT_SECRET={your consumer secret}
```

This information will not be included in the final published website. It's only used to generate the user directory data during build.

## The Code
There's only a few main functions for this project:

### Logging into Salesforce
The `loginToSalesforce` function posts to the Salesforce token endpoint using the OAuth client credentials flow. It uses the `SF_CLIENT_ID` and `SF_CLIENT_SECRET` environment variables, then asks the org which REST API version is newest and uses that.

```javascript
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
    // ...store the access token and instance URL, pick the newest API version
};
```

### Searching Salesforce with SOQL
The `searchUsers` function runs a SOQL query through a small `query` helper that calls the REST API and follows `nextRecordsUrl` for paging. The query pulls active users with their ID, Name, Email and Profile Photo. Profile photos are downloaded locally during build using the access token, since Salesforce requires auth to serve them.

```javascript
const searchUsers = async (authenticatedUserId) => {
    const records = await query(
        'SELECT Id, FirstName, LastName, Email, SmallPhotoUrl FROM User WHERE IsActive = true LIMIT 100'
    );

    const authId15 = authenticatedUserId.substring(0, 15);

    for (const user of records) {
        user.isAuthenticatedUser = user.Id.substring(0, 15) === authId15;
        if (user.SmallPhotoUrl) {
            const localPath = await downloadPhoto(user.SmallPhotoUrl, user.Id);
            user.LocalPhotoUrl = localPath;
        }
    }

    return records;
};
```

### Generating the User Directory
Eleventy then works it's magic to generate the data we'll use for the directory. For this small experiment, I'm not writing the data to a file since I'm limiting the users to 100, but you could easily write it to a JSON file.

Here's the core of the Eleventy config file. It adds the Salesforce users to the global data and creates a collection of users.

```javascript
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
```

### The HTML Template
The `index.njk` file is the template for the user directory. It's a simple list of users with their name, email and profile photo. Profile images are served from locally downloaded copies.

I'm a big fan of [microformats](https://developer.mozilla.org/en-US/docs/Web/HTML/microformats), so I've added some basic h-card markup to the user list. This is a simple way to add some semantic meaning to the user data. You can also use these to style the user list with CSS.

```html
<div class="h-card" role="listitem">
    <img src="{linkToProfileImage}" alt="Profile Image" class="u-photo">
    <div class="user-info">
        <a href="{linkToProfilePage}" class="u-url p-name blur-text">FirstName LastName</a>
        <div class="p-email blur-text">email@address.com</div>
    </div>
</div>
```
> I noticed that eleventy is kind of messing up my HTML indentation. I'll have to look into that.

Search was added client side with some simple javascript. It's not perfect, but it works for this experiment.

```javascript
function filterUsers() {
    const searchBox = document.getElementById('search-box');
    const filter = searchBox.value.toLowerCase();
    const userGrid = document.getElementById('user-grid');
    const users = userGrid.getElementsByClassName('h-card');
    let visibleCount = 0;

    for (let i = 0; i < users.length; i++) {
        const name = users[i].getElementsByClassName('p-name')[0].textContent.toLowerCase();
        const email = users[i].getElementsByClassName('p-email')[0].textContent.toLowerCase();
        if (name.includes(filter) || email.includes(filter)) {
            users[i].style.display = '';
            visibleCount++;
        } else {
            users[i].style.display = 'none';
        }
    }

    const noResults = document.getElementById('no-results');
    if (visibleCount === 0) {
        noResults.textContent = "No users were found matching your criteria.";
        noResults.classList.remove('hidden');
    } else {
        noResults.textContent = "";
        noResults.classList.add('hidden');
    }
}
```

### The CSS
I used flex grid to layout the user list. It's simple and works well for this use case.

You may notice that I'm using a `blur-text` class. Because I wanted to demo this publicly with screenshots and video, I've blurred out the user data for everyone except the authenticated user (determined by the credentials in `.env`). This is a simple way to do it with CSS.

```css
    .blur-text {
        filter: blur(5px); /* Apply blur effect */
    }
```

I have to say, for me, the styling is always the hardest part. I'm not a designer, so I tend to keep things simple. I'm a big fan of [Pico.css](https://picocss.com/) for these small projects.

## Standards and Accessibility
I'm a big fan of [microformats](https://developer.mozilla.org/en-US/docs/Web/HTML/microformats), so I've added some basic h-card markup to the user list. This is a simple way to add some semantic meaning to the user data. You can also use these to style the user list with CSS.

In addition, I attempted to make the site [voiceover accessible](https://www.bocoup.com/blog/getting-started-with-voiceover-accessibility). I'm not an expert in this area, but I tried to make sure the site was navigable with a screen reader.

## Running the Project
To run the project, you'll need to exceute the following command at the terminal:

```
npm start
```

## Known Issues
None at this time. Profile images are now downloaded during build and served locally, resolving the previous SSL/CORS issues.
