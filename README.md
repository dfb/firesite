# firesite
A framework for building simple, web-editable websites using Firestore + svelte.

Lately I've been reaching for [Firebase](https://firebase.google.com/) as the
backend for small websites - it has great free/pay-as-you-go plans and provides
a lot of features out of the gate such as hosting (obviously), a database,
cloud functions, etc.

On the front end, [Svelte](https://svelte.dev/) has quickly become my go-to for
any new projects: it's fast, it (mostly) stays out of my way, and is a treat to
use.

The main thing that has been missing is basic CMS functionality: a way to make
a quick page edit without my full dev environment, or the need to let
non-developers be able to create and edit new pages. This project provides that
missing piece.

# High level design
A firesite-based website is an SPA that stores some or all of its pages in a
Firestore collection (table) instead of individual files on disk. Each page is
in Markdown (though "raw" HTML is also allowed) to make it easier on non-developers,
and images are hosted using Firebase storage.

With the above features in place, it becomes pretty easy to whip together a
basic website without too much trouble. For more complex pages with needs
beyond what can be easily done via markdown, you (as a developer) can add custom
pages as Svelte components, or you can write widgets in Svelte that you (or a
non-developer) can than use in any page via an extension to the markdown syntax.

# Warning
I'm putting this code on github because I'm using it on multiple
sites, not because I think it's in some form that is feature-rich enough for
everybody. It does what I need, and I'll continue to add to it, but... yeah.

# Setting up a new site
Below are the general steps to follow when creating a new site from scratch. Integrating
Firesite into an existing site is doable, but it's generally best to create a new
working directory, getting Firesite set up, and then layering in existing files and
assets.

- `mkdir mysite ; cd mysite`
- `mkdir dbsnap src public ; cd src`
- `git clone git@github.com:dfb/firesite.git`
- `cp -r firesite/starter_files/* ..`
- `cd ../functions`
- Clone and set up the [firesite_backend](https://github.com/dfb/firesite_backend) repo 
- Go into the [Firebase console](https://console.firebase.google.com) and create a new project.
- While there, click the gear icon -> Project settings and on the General tab add a 'web app' if a default was not created.
- Select the app and in the 'SDK setup and configuration' section, click the 'Config' radio button to display the Firebase configuration.
- Copy the keys/values of the config into the corresponding section in src/App.svelte. The final result will be like:
    ```js
    firesite.Init({
        firebaseConfig:{
          apiKey: "...",
          authDomain: "...",
        },
        ...
    ```
- Back in the Firebase cosole (still in Project settings), click the `Service accounts` tab, click `Generate new private key` and save the file as `gcp-prod.json` in your project directory. **Protect this file and never check it into source control!**
- `npm i --save-dev js-sha3 npm-run-all sass svelte svelte-preprocess svelte-scrollto vite autoprefixer @vitejs/plugin-legacy @sveltejs/vite-plugin-svelte firebase firebase-functions firebase-admin moo nearley remarkable include-media`
- optional, for convenience:
    - `firebase login:ci` and approve the permission request
    - copy the token shown in the output of the above command into a file called `setupenv` and prefix it with `export FIREBASE_TOKEN=`. The result will be like:
        `export FIREBASE_TOKEN=1//0AOpy4-...`
    - also add a line with the fullly-qualified path to the `gcp-prod.json` file downloaded from the Firebase console:
        `export GOOGLE_APPLICATION_CREDENTIALS="/c/users/dave/dev/mysite/gcp-prod.json"` # modify this path as needed
    - add `setupenv` to .gitignore because you should always keep this file secret and **never** put it in source control.
    - when you open a new shell/console to do work on this project, do `source setupenv` and then you'll be able to run Firebase commands.
- `firebase use --add` and select your Firebase project
- `firebase deploy --only functions,firestore:rules,storage:rules` # deploy the initial cloud functions and access control rules for Firestore
- Go to the Firebase web console and:
    - click on the `Functions` item in the left panel, and in the Functions dashboard you will see a `main` function listed - this is the function that was just deployed.
    - The Trigger section will display a URL to access this function; put that URL in `src/App.svelte` as the value for the `prodFuncURL` in the `firesite.Init` call.
- Also in the Firebase web console, click on the `Authentication` item in the left panel, and on the `Signin method` tab, make sure the `Anonymous` sign-in provider is enabled (adding it if needed).
- Open the **Google** [Cloud console](https://console.cloud.google.com) and:
    - Firebase is built on Google Cloud, so make sure your project is selected.
    - Click the 3 horizontal lines icon in the top left, then click `APIs & Services` then the `+ Enable APIS and services` button.
    - Search for `IAM Service Account Credentials API` and enable it if it's not enabled already.
    - Click the 3 horizontal lines icon again, then `IAM & Admin`.
    - Click `Roles` on the left, then `+ Create role`. Fill in title=`BlobSigner`, id=`BlobSigner`, roleLaunchStage=`General Availability`,
    - Click `+ Add permissions` and in the **second** search box ('Enter property name or value') type `signblob` and choose `iam.serviceAccounts.signBlob`, check the checkbox to select it, then click the `Add` button.
    - After the dialog closes, click the `Create` button.
    - Along the left side, click `Service accounts` and click on the account that does not have 'adminsdk' in its name.
    - Click the permissions tab, then `Grant access`
    - In the `New principals` box, choose the same service account name.
    - In the `Role` box enter `BlobSigner` and click the `Save` button.

# Local development
When developing your site, you'll have two shells/consoles open, one to run the Firebase emulators and the other to be a local web server. In the first shell:
- `source setupenv`
- `firebase emulators:start --only functions,firestore --export-on-exit --import=dbsnap/`

This will allow you to test cloud functions locally, and will set up a local Firestore emulator so you don't run against production data. If the command
fails, be sure to correct any issues before proceeding. If it fails due to ports being in use, make sure you don't have this command running in another
window. It's also common for a prior run to have no shut down properly, so kill any errant Java processes (on Windows, look for `java.exe` in the Task Manaager).

**The first time you run this command**, copy the URL displayed on this line:
    `+  functions[main]: http function initialized (http://localhost:5001/...).`
and in `src/App.svelte`, paste the URL as the value for the `devFuncURL` key in the `firesite.Init call`.

In the second shell:
- `npm run dev`

This will start up a local webserver at `http://localhost:5000` with Svelte, SASS, and hot module reloading enabled.

# Deploying to production
When you are ready to push a new version of your site to production:
- stop the processes in the 2 development shells above
- `firebase deploy --only functions` # if you've modified anything in `functions/`
- `npm run bd` # runs the packager and then pushes the built files to Firebase hosting
- `firebase deploy --only firestore:rules` # if you've modified `firestore.rules`

# Setting up users
Currently users have to be added to the database manually (sorry!) using the steps below. Note that since the local and
production databases don't share any data, you'll need to add users in both places.
- For each user to add, you'll need the email address and to choose a password to generate the password hash. You can use whatever language you'd like, here's an example using Python for the email address `bob@bob.com` with a password of `HappyDayz1234`:
    ```py
    >>> import hashlib
    >>> hashlib.sha3_256('firesite:bob@bob.com||HappyDayz1234'.encode('utf8')).hexdigest()
    '87396cf24ecac3d95e0ee7dd68c5d4cc9a33ff0574cdd03cf331f6e757de7343'
    ```
- Note the prefix `firesite` in the input string; it is simply for a salt value. You can use a different value for the prefix when generating hashes, but be sure to edit `src/App.svelte`'s call to `firesite.Init` so that it passes `passwordSaltPrefix:&lt;your custom value&gt;` in the call.
- Make sure the emulators are running (from the `Local development` section above)
- Open a web browser to the Firestore UI. For local dev, is http://localhost:4001; for production you can access the UI via the Firebase web console.
- Create a `User` collection and add a document with:
    - `email` (type=string), with a value of the user's email address
    - `passwordHash` (type=string), with a value of the calculated password hash
    - `roles` (tyep=map), with an entry of either `member` or `admin` with a value of 1 (type=number)

# Routes and site layout
The `ROUTES` list in `src/App.svelte` is where you define the organization of your website - what pages are available
and what URLs are used to reach them. For each page, you need to decide if you want it to be a web-editable *SitePage*
or if you want it to be implemented as a *Svelte component*.

SitePages can be created and edited through the web (and without access to the dev environment) and support Markdown or
"raw" HTML, and can make use of reusable Svelte components you have created. SitePages are a good option for cases where
you need to give edit access to a non-developer or to someone who doesn't want to mess with getting a dev environment set
up, and/or when you want to be able to make quick edits to a site, including when you're away from your main computer. They
are not a good option when your page needs extensive Javascript or you want to make use of the power of Svelte.

Pages implemented as Svelte components offer unlimited power/flexibility, but require development experience. Also, adding
new pages or editing these pages requires you to do a new release of your site.

Each entry in the routes table is a Javascript object with:
- `path` - a string or regex for the page. If you use a regex with named parameters, your component should expose a `params` variable to receive any named parameters.
- `comp` - the component that will be rendered for that page

Note that the routes table is *ordered* and Firesite will use the first match it finds.

As an example, here is a routes table for a site that uses a Svelte component for the landing (index) page, exposes the builtin
admin page, and then implements everything else on the site as SitePages:
    ```js
    import HomePage from './homepage.svelte'; // you'd implement this as a normal Svelte component
    const ROUTES = [
        {path:'/', comp:HomePage},
        {path:'/secret/admin', comp:admin},
        {path:new RegExp('.*'), comp:SitePage},
    ]
    ```

If you want the landing page ('/') to be a SitePage, give it the name `index`; Firesite recognizes this as a special case.

As mentioned earlier, a Firesite-based website is actually an SPA, though from the user's perspective this isn't overly obvious -
the URLs *look* like normal URLs (and are not hash-based) and the browser history works properly. The site is an SPA, however, so
that navigation among pages doesn't reset our connection to the database or reset our in memory cache of records read from the
database. At some point this may change (e.g. use local storage for the cache).

Currently, the builtin admin page is best described as "absurdly cheesy" and can be used to see what pages exist and add new pages,
but that's about it.

# Still to document
- Uploading images and other files
- Public dir - put favicon, global css, shipped images, etc. in here and '/public' maps to '/' on the finished site
- creating SitePage widgets
- using SitePage widgets - in the markdown, `{widgetname param="x" other="y"}`
- adding more backend actions - don't add whole new functions, just add an action. Client side, use CloudCall.

# Still to do
- more default widgets, such as Image
- file manager
- make everything less crappy
- local dev but hit prod db/functions: add `?prod=1` to page URL

