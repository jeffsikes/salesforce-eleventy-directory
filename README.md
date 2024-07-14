# Eleventy Experiement: Salesforce User Directory
This is a simple experiment to see if I can use Eleventy to generate a small user directory from a Salesforce SOQL query.

I'm using the [JSForce](https://jsforce.github.io/) library to connect to Salesforce and run a SOQL query to get a list of users. I'm then using Eleventy to generate a static site with the user data.

> I used JSForce 2.0 for this experiment. It looks like JSForce 3.0 is coming out soon, so I'll have to update this when it's released.

Obviously not a real-world use case, but it's a fun experiment to see how Eleventy can be used to generate static sites from Salesforce data.

## Project Setup
I wanted to keep things simple, so I'm using very limited dependencies. Here's what you need to get started:

1. Install [Node.js](https://nodejs.org/) (I'm using v18.20.2)
2. Install [Eleventy](https://www.11ty.dev/): `npm install -g @11ty/eleventy`
3. Install [JSForce](https://github.com/jsforce/): `npm install jsforce`

I decided against using a CSS framework for simplicity. If I did use one, tho, for these little lab experiments I'd probably use [Pico.css](https://picocss.com/).

## Salesforce Setup
You'll need some information from your Salesforce instance to get started.

| Required Fields | Description |
|-----------------|-------------|
|Salesforce URL | The URL for your Salesforce instance. For example, `https://mycompany.my.salesforce.com`. |
|Salesforce Username | A Salesforce username that has API access (will explain how to get this later). For production, you should create a dedicated user for this. |
|Salesforce Password | The password for the Salesforce user. |
|Salesforce Security Token | A security token for the Salesforce user. If you already have one, great! If not, follow the directions below. |

### Getting a Salesforce Security Token
You may have already generated a security token. If you have it, use it! 

Otherwise, login into Salesforce with the username you chose, clicking on your profile picture, and selecting "Settings". From there, click on "Reset My Security Token". You'll receive an email with the token. It took about 5 minutes to get mine. Make sure to store it somewhere safe, because you can't see it again.

Note that if you ever reset your password, the security token will be reset as well. This isn't the best route for production, but it's fine for this experiment.

Your username, password and token should be stored in a `.env` file in the root of the project. Here's what mine looks like:

```
SF_LOGIN_URL={your Salesforce URL}
SF_USERNAME={your Salesforce username}
SF_PASSWORD={your Salesforce password}
SF_TOKEN={your Salesforce security token}
```

This information will not be included in the final published website. It's only used to generate the user directory data during build.

## The Code
There's only a few main functions for this project:

### Logging into Salesforce
The `loginToSalesforce` function uses the `jsforce` library to log into Salesforce. It uses the `SF_USERNAME`, `SF_PASSWORD`, and `SF_TOKEN` environment variables to authenticate.

Here's the related code. JSForce makes it fairly simple. Note that I'm using V2.0 of JSForce, but it looks like V3.0 is coming out very soon.

```javascript
const loginToSalesforce = () => {
    return conn.login(process.env.SF_USERNAME, process.env.SF_PASSWORD + process.env.SF_TOKEN, (err, userInfo) => {
        if (err) {
            return console.error(err);
        }
        console.log("User ID: " + userInfo.id);
        console.log("Org ID: " + userInfo.organizationId);
    });
};
```

### Searching Salesforce with SOQL + JSForce
The `searchUsers` function uses the `query` method from the `jsforce` library to run a SOQL query against Salesforce. The query is simple: `SELECT Id, FirstName, LastName, Email, SmallPhotoUrl`. This returns a list of users with their ID, Name, Title, Email and Profile Photo if it exists.

```javascript
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
```

### Generating the User Directory
Eleventy then works it's magic to generate the data we'll use for the directory. For this small experiment, I'm not writing the data to a file since I'm limiting the users to 100, but you could easily write it to a JSON file.

Here's the core of the Eleventy config file. It adds the Salesforce users to the global data and creates a collection of users.

```javascript
module.exports = function(eleventyConfig) {
    eleventyConfig.addGlobalData("env", process.env);

    eleventyConfig.addCollection("salesforceUsers", async function(collectionApi) {
        await loginToSalesforce();
        const users = await searchUsers();
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
The `index.njk` file is the template for the user directory. It's a simple list of users with their name, title, email and profile photo. I'm using the `SmallPhotoUrl` field from Salesforce to display the profile photo.

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

You may notice that I'm using a `blur-text` class. Because I wanted to demo this publicly with screenshots and video, I've blurred out the user data for everyone but myself. This is a simple way to do it with CSS.

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
npx eleventy --serve
```

## Known Issues
When running locally, profile images may not appear. Images are loaded on SSL from Salesforce, but locally I'm running on HTTP. A work around would be to download all profile images and host them locally. 

Note that it works in Edge, but not in Chrome or Firefox.
