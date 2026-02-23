var getPrefetchData = require('@toolkit/api-prefetch/client').getPrefetchData;

console.log('App started!');

setTimeout(function () {
  console.log('App is now making regular API calls...');

  var prefetched = getPrefetchData('/api/user/info');

  var dataPromise = prefetched
    ? prefetched
    : fetch('/api/user/info').then(function (r) { return r.json(); });

  dataPromise
    .then(function (data) { console.log('User info:', data); })
    .catch(function (err) { console.error('Error fetching user info:', err); });
}, 2000);
