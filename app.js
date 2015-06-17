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
	redisReady = false;

redisClient.on("ready", function(){
	redisReady = true;
	console.log("Redis connection established");
})

 redisClient.on("error", function(){
 	redisReady = false;
 	console.log("Redis server disconnected");
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
			if(redisReady){
				redisClient.lrange("messages", 0, 19, function(err, messages){
					// create array of redis list items
					messages = messages.reverse();
					// Each array element is a stringified array of format
					// "[\"(username)\", \"(message)\"]". De-stringify each of these internal
					// arrays and send the username and message (first and second internal 
					// array elements) as paramaters for the chat message event emitted to
					// the client
					messages.forEach(function(m){
						m=JSON.parse(m);
						client.emit('chat message', m[0], m[1]);
					});
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
			redisClient.lpush("messages", JSON.stringify([client.username, msg]));
			// if list is longer than 10 items, remove the last one
			if(redisClient.llen("messages")>50){
				redisClient.ltrim("messages", 0, 49);
			}
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