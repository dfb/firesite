# firesite
A framework for building simple, web-editable websites using Firestore + svelte.

Lately I've been reaching for [Firebase](https://firebase.google.com/) as the backend for small websites - it has great free/pay-as-you-go plans and provides a lot of features out of the gate such as hosting (obviously), a database, cloud functions, etc.

On the front end, [Svelte](https://svelte.dev/) has quickly become my go-to for any new projects: it's fast, it (mostly) stays out of my way, and is a treat to use.

The main thing that has been missing is basic CMS functionality: a way to make a quick page edit without my full dev environment, or the need to let non-developers be able to create and edit new pages. This project provides that missing piece.

# High level design
A firesite-based website is an SPA that stores most or all of its pages in a Firestore collection (table) instead of individual files on disk. Each page is in Markdown (though "raw" HTML is also allowed) to make it easier on non-developers, and images are hosted using Firebase storage.

With the above features in place, it becomes pretty easy to whip together a basic website without too much trouble. For more complex pages with needs beyond what can be easily done via markdown, you (as a developer) can write widgets in Svelte that you (or a non-developer) can than use in any page via an extension to the markdown syntax.

# Warning
I'm putting this code on github because I'm using it on multiple sites, not because I think it's in some form that is feature-rich enough for everybody. It does what I need, and I'll continue to add to it, but... yeah.
