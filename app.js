var express = require('express'), 
	redis = require('redis'),
	path = require('path'),
	app = express(),
	http = require('http').Server(app),
	io = require('socket.io')(http),
	numClients = 0,
	usersOnline = {},
	invalidCharacters = new RegExp("[^a-zA-Z0-9 ]"),
	redisClient = redis.createClient(6379, "localhost"),
	redisReady = false,
	// Array to store messages from Redis server
	messageList = [];

redisClient.on("ready", function(){
	redisReady = true;
	//if messageList array is empty, populate it from Redis list
	if(messageList.length===0){
		console.log("populating array");
		redisClient.lrange("messages", 0, 24, function(err, messages){
			messages.reverse();
			messages.forEach(function(m){
				messageList.push(m);
			});
		});
	}
	else{
		console.log("populating Redis list");
		redisClient.ltrim("messages", 1, 0);
		console.log(redisClient.lrange("messages", 0, -1));
		var reverseList = messageList
			.slice(0)
			.reverse();
		console.log(reverseList, messageList);
		reverseList.forEach(function(m){
			redisClient.rpush("messages", m);
		});
	}
	console.log("Redis connection established");
});

 redisClient.on("error", function(){
 	if(redisClient){
	 	console.log(messageList);
	 	redisReady = false;
	 	console.log("Redis server disconnected");
	 }
 });

// redisClient.set("key", "value");

app.use(express.static(__dirname + '/public'));
app.get('/', function(req, res){
	res.sendFile(path.join(__dirname, './', 'index.html'));
});

io.sockets.on('connection', function(client){
	client.on('signin', function(name){
		if(!name || name==="null"){
		 	client.emit('no name');
		}
		else if(name.match(invalidCharacters)){
			client.emit('name illegal');
		}
		else if (!usersOnline.hasOwnProperty(name)){
			usersOnline[name]=client;
			client.username = name;
			console.log(name + " joined the chat");
			client.broadcast.emit('connection', name);
			numClients++;
			client.id = numClients;
			//if Redis server running, add messages to page from Redis list
			if(redisReady){
				redisClient.lrange("messages", 0, 24, function(err, messages){
					// create array of redis list items.  Reverse is necessary
					//because new items are pushed to the front of the list.
					messages = messages.reverse();
					// Each array element is a stringified array of format
					// "[\"(username)\", \"(message)\"]". De-stringify each of 
					//these internalarrays and send the username and message
					//(first and second internal array elements) as paramaters
					//for the chat message event emitted to the client
					messages.forEach(function(m){
						m=JSON.parse(m);
						client.emit('chat message', m[0], m[1]);
					});
				});
			}
			//if Redis server down, add messages to page from messageList JS
			//array
			else {
				// no reverse here since new items are pushed to the back of the
				//array
				messageList.forEach(function(m){
					m = JSON.parse(m);
					client.emit('chat message', m[0], m[1]);
				});
			}
		}
		else {
			client.emit('name taken');
		}
	});
	client.on('validate name', function(name){
		if(name.match(invalidCharacters)){
			client.emit('name illegal');
		}
		else if(!name || name==="null"){
			client.emit('no name');
		}
		else if(usersOnline.hasOwnProperty(name)){
			client.emit('name taken');
		}
		else {
			client.emit('name valid');
		}
	});
	client.on('chat message', function(msg){
		console.log('message: ' + msg);
		// create array of username and message, put it in string form, and
		// push it to messages redis list
		if(redisReady){
			redisClient.lpush(
				"messages", JSON.stringify([client.username, msg]));
			// if list is longer than 25 items, remove the last one
			if(redisClient.llen("messages")>25){
				redisClient.ltrim("messages", 0, 24);
			}
		}
		messageList.push(JSON.stringify([client.username, msg]));
		if(messageList.length>25){
			messageList.shift();
		}
		client.broadcast.emit('chat message', client.username, msg);
		client.broadcast.emit('finished typing', client.username);
	});
	client.on('disconnect', function(){
		console.log(client.username + " disconnected");
		delete usersOnline[client.username];
		client.broadcast.emit('leave', client.username);
	});
	client.on('typing', function(){
		console.log(client.username + " is typing");
		client.broadcast.emit('type', client.username, client.id);
	});
	client.on('finished typing', function(){
		console.log(client.username + " has finished typing");
		client.broadcast.emit('finish typing', client.username, client.id);
	});
});

http.listen(3000, function(){
	console.log('Listening on port 3000...');
});