import {fetchPosts} from 'fetch-reddit';
import binarySearch from 'binary-search-promises';

import {List, Queue, Dictionary} from './storageContainers.js';
const queue = new Queue('queue');
const results = new List('results');
const titleStore = new Dictionary('titles');

const players = {};
const YOUTUBE_API_KEY = 'AIzaSyD-YLstteQd9Hpgoo46p--xAvYWzXiM9oU';

const update = function() {
    const div = document.getElementById('results');
    if (div.firstChild) {
        div.removeChild(div.firstChild);
    }
    const ul = document.createElement('ol');
    results.to_array().then(array => {
        array.reverse().forEach(x => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = 'https://www.youtube.com/watch?v=' + x;
            a.target = '_blank';
            titleStore.get(x).then(title => a.innerHTML = title);
            li.appendChild(a);
            ul.appendChild(li);
        });
    });
    div.appendChild(ul);
};

const parse_reddit = function(posts) {
    return titleStore.to_object().then(titles => {
        let newQueue = posts
            .map(post => parse_youtube_id(post.url))
            .filter(id => id !== null)
            .filter(id => titles[id] === undefined);

        let youtubeRequests = newQueue.map(get_youtube_title);
        let titleStoreUpdate = Promise.all(youtubeRequests).then(idTitles => {
            let aggregator = {};
            idTitles.forEach(idTitle => {
                let [id, title] = idTitle;
                aggregator[id] = title;
            });
            return titleStore.merge(aggregator);
        })

        return Promise.all([titleStoreUpdate, queue.extend(newQueue)]);
    });
};

const get_youtube_title = function(videoId) {
    let url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&fields=items(id%2Csnippet)&key=${YOUTUBE_API_KEY}`;
    return fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data['error']) {
                return Promise.reject('An error occurred trying to access the YouTube API: ' + data['error']['message']);
            } else {
                let title = data['items'][0]['snippet']['title'];
                return Promise.resolve([videoId, title]);
            }
        });
};


// Stolen from http://stackoverflow.com/a/9102270
const parse_youtube_id = function(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length == 11) {
        return match[2];
    } else {
        return null;
    }
};

const play_video = function(player_id, video_id) {
    return new Promise((resolve, reject) => {
        let player = players[player_id];
        if (player === undefined) {
            /* global YT */
            players[player_id] = new YT.Player(player_id, {
                videoId: video_id,
                events: {
                    onReady: event => resolve(event.target),
                    onError: event => reject('YouTube error: ' + event.data)
                }
            });
        } else {
            // Prevent having to restart the video when it's just the same one again anyway.
            if (video_id !== player.getVideoData().video_id) {
                player.cueVideoById(video_id);
            }
            resolve(player);
        }
    });
};

const compareSongs = function() {
    let buttonA = document.getElementById('choose_a');
    let buttonB = document.getElementById('choose_b');

    return Promise.all([results.to_array(), queue.peek(), titleStore.to_object()]).then(args => {
        let [haystack, needle, titles] = args;
        binarySearch(haystack, needle, function(a, b) {
        return Promise.all([play_video('player1', a), play_video('player2', b)])
            .then(players => {
                buttonA.value = titles[a];
                buttonB.value = titles[b];
                return Promise.race([
                    new Promise((resolve, reject) => buttonA.onclick = e => resolve(1)),
                    new Promise((resolve, reject) => buttonB.onclick = e => resolve(-1))
                ]);
            });
        }).then(resolution => {
            let [, position] = resolution;
            results.insert(needle, position).then(() => {
                queue.pop().then(() => {
                    update();
                    return compareSongs();
                });
            });
        });
    });
};

const init = function() {
    update();

    fetchPosts('/r/PowerMetal/')
        .then(data => parse_reddit(data.posts))
        .then(compareSongs)
        .catch(console.error);
};
init();
