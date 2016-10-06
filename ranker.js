import {fetchPosts} from 'fetch-reddit';
import binarySearch from 'binary-search-promises';

import {List, Queue, Dictionary} from './storageContainers.js';
const queue = new Queue('queue');
const results = new List('results');
const titleStore = new Dictionary('titles');

import EventEmitter from 'events';

const players = {};
const YOUTUBE_API_KEY = 'AIzaSyD-YLstteQd9Hpgoo46p--xAvYWzXiM9oU';

function update() {
    const div = document.getElementById('results');
    if (div.firstChild) {
        div.removeChild(div.firstChild);
    }
    const ul = document.createElement('ol');
    results.toArray().then(array => {
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
}

function parseReddit(posts) {
    return titleStore.toObject().then(titles => {
        let newQueue = posts
            .map(post => parseYouTubeID(post.url))
            .filter(id => id !== null)
            .filter(id => titles[id] === undefined);

        let youtubeRequests = newQueue.map(getYouTubeTitle);
        let titleStoreUpdate = Promise.all(youtubeRequests).then(idTitles => {
            let aggregator = {};
            idTitles.forEach(idTitle => {
                let [id, title] = idTitle;
                aggregator[id] = title;
            });
            return titleStore.merge(aggregator);
        });

        return Promise.all([titleStoreUpdate, queue.extend(newQueue)]);
    });
}

function getYouTubeTitle(videoId) {
    let url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&fields=items(id%2Csnippet)&key=${YOUTUBE_API_KEY}`;
    /* global fetch */
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
}


// Stolen from http://stackoverflow.com/a/9102270
function parseYouTubeID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length == 11) {
        return match[2];
    } else {
        return null;
    }
}

// YouTube's API is terrible: they haven't properly implemented removeEventListener!
// This is adapted from: https://code.google.com/p/gdata-issues/issues/detail?id=6700#c10
function fixYouTubePlayerEventListener(player) {
    const delegateController = new EventEmitter();
    const eventTypes = ['onReady', 'onStateChange', 'onError', 'onPlaybackQualityChange',
                        'onPlaybackRateChange', 'onApiChange'];
    eventTypes.forEach(eventType => {
        player.addEventListener(eventType, (...args) => delegateController.emit(eventType, ...args));
    });

    player.addEventListener = (name, fn) => {
        delegateController.on(name, fn);
    };

    player.removeEventListener = (name, fn) => {
        delegateController.removeListener(name, fn);
    };
}

function playVideo(playerID, videoID) {
    return new Promise((resolve, reject) => {
        let player = players[playerID];
        if (player === undefined) {
            /* global YT */
            player = new YT.Player(playerID, {
                videoId: videoID,
                events: {
                    onReady: (event) => resolve(event.target),
                    onError: (event) => reject('YouTube error: ' + event.data)
                }
            });
            fixYouTubePlayerEventListener(player);
            players[playerID] = player;
        } else {
            // Prevent having to restart the video when it's just the same one again anyway.
            if (videoID === player.getVideoData().video_id) {
                resolve(player);
            } else {
                const onStateChange = (event) => {
                    if (event.data === YT.PlayerState.CUED) {
                        player.removeEventListener('onStateChange', onStateChange);
                        player.removeEventListener('onError', onError);
                        resolve(event.target);
                    }
                };

                const onError = (event) => {
                    player.removeEventListener('onStateChange', onStateChange);
                    player.removeEventListener('onError', onError);
                    reject('YouTube error: ' + event.data);
                };

                player.addEventListener('onStateChange', onStateChange);
                player.addEventListener('onError', onError);
                player.cueVideoById(videoID);
            }
        }
    });
}

function compareSongs() {
    let buttonA = document.getElementById('chooseA');
    let buttonB = document.getElementById('chooseB');

    return Promise.all([results.toArray(), queue.peek(), titleStore.toObject()]).then(args => {
        let [haystack, needle, titles] = args;

        if (needle === undefined) {
            return Promise.resolve('done');
        }

        return binarySearch(haystack, needle, function(a, b) {
            return Promise.all([playVideo('player1', a), playVideo('player2', b)])
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
            return results.insert(needle, position).then(() => {
                return queue.pop().then(() => {
                    update();
                    return compareSongs();
                });
            });
        });
    });
}

function finished() {
    Object.keys(players).forEach(playerID => {
        players[playerID].destroy();
    });

    let choicesDiv = document.getElementById('choices');
    choicesDiv.style.display = 'none';

    let doneDiv = document.getElementById('done');
    doneDiv.style.display = 'block';
}

function init() {
    let clearButton = document.getElementById('clearResults');
    clearButton.addEventListener('click', event => {
        if (window.confirm('Are you sure you want to clear your rankings?')) {
            results.toArray()
                .then(array => queue.extend(array))
                .then(() => results.clear())
                .then(() => window.location.reload())
                .catch(console.error);
        }
    });

    update();

    fetchPosts('/r/PowerMetal/')
        .then(data => parseReddit(data.posts))
        .then(compareSongs)
        .then(finished)
        .catch(console.error);
}
init();
