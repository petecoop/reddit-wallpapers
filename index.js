var Promise = require('bluebird');
var request = require('request-promise');
var config = require('./config.json');
var fs = Promise.promisifyAll(require("fs"));
var setWallpaper = Promise.promisify(require('wallpaper').set);

var cache = null;
var id = null;

var supportedDomains = [
  'i.imgur.com',
  'imgur.com'
];

getCache()
  .then(function (result) {
    cache = result;
  })
  .then(getSubreddit)
  .then(getWallpaper)
  .then(setWallpaper)
  .then(writeCache);

function getCache () {
  return fs.readFileAsync(__dirname + '/.cache.json', {encoding: 'utf8'})
    .then(function (cache) {
      return JSON.parse(cache);
    })
    .catch(function () {
      return {
        lastSubreddit: null,
        lastWallpaper: null,
        seen: []
      };
    });
}

function getSubreddit () {
  var subreddits = config.subreddits;
  var subreddit;
  if(cache.lastSubreddit){
    var index = config.subreddits.indexOf(cache.lastSubreddit);
    if(index !== -1 && index !== config.subreddits.length - 1){
      subreddit = config.subreddits[index + 1];
    }
  }
  if(!subreddit) subreddit = config.subreddits[0];
  return subreddit;
}

function getWallpaper (subreddit) {

  cache.lastSubreddit = subreddit;

  return request({
    url: 'http://www.reddit.com/r/' + subreddit + '.json',
    json: true
  }).then(function (result) {
    // filter to supported domains and unseen images
    return result.data.children.filter(function (item) {
      var data = item.data;
      return supportedDomains.indexOf(data.domain) !== -1
        && cache.seen.indexOf(data.id) === -1;
    })[0].data;
  })
  .then(function (item) {
    id = item.id;
    cache.seen.push(item.id);

    // get image url

    // hack for imgur imgs
    if(item.domain == 'imgur.com'){
      return item.url.replace('imgur.com', 'i.imgur.com') + '.jpg';
    }

    return item.url;
  })
  .then(function (url) {
    return new Promise(function (resolve, reject) {
      var path = __dirname + '/wallpapers/' + id;
      request(url)
        .pipe(fs.createWriteStream(path))
        .on('finish', function () {
          fs.unlinkAsync(cache.lastWallpaper)
            .catch(function () {})
            .finally(function () {
              cache.lastWallpaper = path;
              resolve(path);
            })
        });
    });
  });
}

function writeCache () {
  var json = JSON.stringify(cache);
  return fs.writeFileAsync('.cache.json', json);
}

