import {fetchPosts} from 'fetch-reddit';
import binarySearch from 'binary-search-promises';

import {List, Queue} from './storageContainers.js'
const queue = new Queue('/queue');
const results = new List('/results');

var players = {};
var players_last = {};

var YOUTUBE_API_KEY = 'AIzaSyD-YLstteQd9Hpgoo46p--xAvYWzXiM9oU';

var TITLE_KEY_PREFIX = '/title/';
var VISITED_KEY_PREFIX = '/visited/';
var title_key = function(id) {
    return TITLE_KEY_PREFIX + id;
};
var visited_key = function(id) {
    return VISITED_KEY_PREFIX + id;
};

var update = function() {
    var div = document.getElementById('results');
    if (div.firstChild) {
        div.removeChild(div.firstChild);
    }
    var ul = document.createElement('ol');
    results.to_array().then(array => {
        array.reverse().forEach(x => {
            var li = document.createElement('li');
            var a = document.createElement('a');
            a.href = 'https://www.youtube.com/watch?v=' + x;
            a.target = '_blank';
            a.innerHTML = localStorage[title_key(x)];
            li.appendChild(a);
            ul.appendChild(li);
        });
    });
    div.appendChild(ul);
};

var parse_reddit = function(posts) {
    var new_queue = posts
        .map(post => parse_youtube_id(post.url))
        .filter(id => id !== null)
        .filter(id => localStorage[visited_key(id)] === undefined);

    let youtube_requests = new_queue
        .filter(videoId => localStorage[title_key(videoId)] === undefined)
        .map(get_youtube_title);

    new_queue.forEach(function(videoId) {
        localStorage[visited_key(videoId)] = 'true';
    });

    return Promise.all(youtube_requests.concat(queue.extend(new_queue)));
};

var get_youtube_title = function(videoId) {
    let url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&fields=items(id%2Csnippet)&key=${YOUTUBE_API_KEY}`;
    return fetch(url)
        .then(response => response.json())
        .then(data => {
            return new Promise((resolve, reject) => {
                if (data['error']) {
                    reject('An error occurred trying to access the YouTube API: ' + data['error']['message']);
                }
                else {
                    var id = data['items'][0]['id'];
                    var title = data['items'][0]['snippet']['title'];
                    localStorage[title_key(id)] = title;
                    resolve(id);
                }
            })
        });
};


// Stolen from http://stackoverflow.com/a/9102270
var parse_youtube_id = function(url) {
    var regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    var match = url.match(regExp);
    if (match && match[2].length == 11) {
        return match[2];
    }
    else {
        return null;
    }
};

var play_video = function(player_id, video_id) {
    if (!players[player_id]) {
        players[player_id] = new YT.Player(player_id, {
            videoId: video_id
        });
    }
    else {
        // Prevent having to restart the video when it's just the same one again anyway.
        if (video_id !== players_last[player_id]) {
            var player = players[player_id];
            player.cueVideoById(video_id);
            players_last[player_id] = video_id;
        }
    };
};

const init = function() {
    update();

    let buttonA = document.getElementById('choose_a');
    let buttonB = document.getElementById('choose_b');

    const compareSongs = function() {
        Promise.all([results.to_array(), queue.peek()]).then(args => {
            let [haystack, needle] = args;
            binarySearch(haystack, needle, function(a, b) {
                play_video('player1', a);
                play_video('player2', b);
                buttonA.value = localStorage[title_key(a)];
                buttonB.value = localStorage[title_key(b)];
                return Promise.race([
                    new Promise((resolve, reject) => buttonA.onclick = e => resolve(1)),
                    new Promise((resolve, reject) => buttonB.onclick = e => resolve(-1))
                ]);
            }).then(resolution => {
                let [found, position] = resolution;
                results.insert(needle, position).then(() => {
                    queue.pop().then(() => {
                        update();
                        compareSongs();
                    });
                });
            });
        });
    };

    fetchPosts('/r/PowerMetal/')
        .then(data => parse_reddit(data.posts))
        .then(compareSongs)
        .catch(console.error);
};
init();
