var queue = [];
var results = [];
var current_value = null;

var top_index = 0;
var mid_index = 0;
var bot_index = 0;

var players = {};
var players_last = {};

var YOUTUBE_API_KEY = 'AIzaSyD-YLstteQd9Hpgoo46p--xAvYWzXiM9oU';

var RESULTS_KEY = '/results';
var QUEUE_KEY = '/queue';
var TITLE_KEY_PREFIX = '/title/';
var VISITED_KEY_PREFIX = '/visited/';
var title_key = function(id) { return TITLE_KEY_PREFIX + id; };
var visited_key = function(id) { return VISITED_KEY_PREFIX + id; };

var update = function() {
    var div = document.getElementById('results');
    if (div.firstChild) {
        div.removeChild(div.firstChild);
    }
    var ul = document.createElement('ol');
	if (!localStorage[RESULTS_KEY]) {
		results = [];
	} else {
		results = localStorage[RESULTS_KEY].split(',');
	}
    results.slice().reverse().forEach(function(x) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = 'https://www.youtube.com/watch?v=' + x;
        a.target = '_blank';
        a.innerHTML = localStorage[title_key(x)];
        li.appendChild(a);
        ul.appendChild(li);
    });
    div.appendChild(ul);

    next();
};

var next = function() {
	localStorage[QUEUE_KEY] = queue.join();
    if (queue.length > 0) {
        init_questions(queue.pop());
    } else {
		var divs = document.body.getElementsByClassName('video_option');
		for (var i = 0; i < divs.length; i++) {
			divs[i].style.display = 'none';
		}

		document.getElementById('done').style.display = 'block';

		if (players['player1']) {
			players['player1'].destroy();
			delete players['player1'];
		}
		if (players['player2']) {
			players['player2'].destroy();
			delete players['player2'];
		}
    }
};

var init_questions = function(value) {
    if (results.length == 0) {
        results.push(value);
		localStorage[RESULTS_KEY] = results.join();
        update();
        return;
    }

    current_value = value;
    top_index = results.length - 1;
    bot_index = 0;
    mid_index = (top_index + bot_index) / 2 | 0;

    ask_question();
};

var ask_question = function() {	
	var comparisons_left = Math.floor(Math.log(top_index - bot_index + 1) / Math.log(2));
    var test_val = results[mid_index];
    var question = document.getElementById('question');
	document.getElementById('comparison_counter').innerHTML = comparisons_left + 1;
    document.getElementById('choose_a').value = localStorage[title_key(current_value)];
    document.getElementById('choose_b').value = localStorage[title_key(test_val)];
    play_video('player1', current_value);
    play_video('player2', test_val);
};

var choose_a = function() {
    bot_index = mid_index + 1;
    test_done();
};

var choose_b = function() {
    top_index = mid_index - 1;
    test_done();
};

var test_done = function() {
    mid_index = (top_index + bot_index) / 2 | 0;
    if (bot_index > top_index) {
        results.splice(bot_index, 0, current_value);
		localStorage[RESULTS_KEY] = results.join();
        update();
    } else if (top_index < bot_index) {
        results.splice(top_index, 0, current_value);
		localStorage[RESULTS_KEY] = results.join();
        update();
    } else {
        ask_question();
    }
};

var parse_reddit = function(data) {
	if (localStorage[QUEUE_KEY]) {
		queue = localStorage[QUEUE_KEY].split(',');
	} else {
		queue = [];
	}
	var new_queue = data.data.children
         .filter(function(x) { return x.data.domain === 'youtube.com'; })
         .map(function(x) {
             return parse_youtube_id(x.data.url);
         })
         .filter(function(x) { return x !== null; })
		 .filter(function(x) { return localStorage[visited_key(x)] === undefined; });
	queue = queue.concat(new_queue);
    new_queue.forEach(function(x) {
		if (!localStorage[title_key(x)]) {
		    var script = document.createElement('script');
		    script.src = 'https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' + x +
			'&fields=items(id%2Csnippet)&callback=get_youtube_title&key=' + YOUTUBE_API_KEY
		    document.head.appendChild(script);
		}
		localStorage[visited_key(x)] = 'true';
    });
	localStorage[QUEUE_KEY] = queue.join();
};

var get_youtube_title = function(data) {
    if (data['error']) {
	alert('An error occurred trying to access the YouTube API:\n\n' + data['error']['message']);
	get_youtube_title = function(data) {}; // Prevent alert spam.
    }
    var id = data['items'][0]['id'];
    var title = data['items'][0]['snippet']['title'];
    localStorage[title_key(id)] = title;
};

// Stolen from http://stackoverflow.com/a/9102270
var parse_youtube_id = function(url) {
    var regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    var match = url.match(regExp);
    if (match&&match[2].length==11){
        return match[2];
    } else {
        return null;
    }
};

var play_video = function(player_id, video_id) {
    if (!players[player_id]) {
        players[player_id] = new YT.Player(player_id, {
            videoId: video_id
        });
    } else {
		// Prevent having to restart the video when it's just the same one again anyway.
		if (video_id !== players_last[player_id]) {
			var player = players[player_id];
			player.cueVideoById(video_id);
			players_last[player_id] = video_id;
		}
    };
};

var clear_results = function() {
	var keys = Object.keys(localStorage).filter(function(x) {
		return x.indexOf(VISITED_KEY_PREFIX) === 0 || 
			x === QUEUE_KEY || x === RESULTS_KEY;
	});
	for (var i = 0; i < keys.length; i++) {
		delete localStorage[keys[i]];
	}
	location.reload();
};
