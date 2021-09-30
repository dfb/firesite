<script>
import * as firesite from './firesite';
import Router from './firesite/router.svelte';
import SitePage from './firesite/SitePage.svelte';
import admin from './firesite/admin.svelte';

// TODO: import your page components and site-specific widgets here
// e.g.
//  import about from './about.svelte';
//  import fancybutton from './fancybutton.svelte';

const ROUTES = [
    // TODO: list your page URLs here in order
    // examples:
    //  {path:'/about', comp:about}, // simple fixed URL
    //  {path:'/', comp:index},
    //  {path:new RegExp('/the/(?<bob>.*)'), comp:backend}, // page that uses path elements as parameters
    //  {path:new RegExp('/pages/.*'), comp:SitePage}, // page that renders web-editable pages
    //  {path:'/admin', comp:admin}, // gotta include this somewhere to enable the admin UI
];

// setup firesite/firebase
firesite.Init({
    firebaseConfig:{
      // TODO: paste in the JSON blob from the Firebase console - it'll have keys like apiKey, authDomain, projectId, etc.
    },
    devFuncURL:'', // TODO: fill this in, it'll be like http://localhost:5001/myprj-1234/us-central1/main',
    prodFuncURL:'', // TODO: fill this in, it'll be like https://us-central1-myprj-1234.cloudfunctions.net/main',
    //notFoundComp:not_found, // TODO: pass in the comp to use for page-not-found situations
    routes:ROUTES,
    appWidgets:{}, // TODO: add site-specific widgets, e.g. {'fancybutton':fancybutton, ...},
    //passwordSaltPrefix:'', // TODO, optional: extra chars to include when hashing passwords
});

</script>

<Router/>

