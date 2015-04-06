var express = require('express'), 
	// redis = require('redis'),
	path = require('path'),
	app = express(),
	http = require('http').Server(app),
	io = require('socket.io')(http),
	numClients = 0,
	usersOnline = {},
	invalidCharacters = new RegExp("[^a-zA-Z0-9 ]"),
	// redisClient = redis.createClient(3000, "localhost"), 
	messages = [];

// redisClient.on("error", function(err){
// 	console.log(err);
// });

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
			messages.forEach(function(m){
				client.emit('chat message', m.username, m.message);
			});
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
		// redisClient.lpush("messages", msg, function(err, reply){
		// 	redisClient.lrange("messages", 0, -1, function(err, messages){
		// 		console.log(messages);
		// 	});
		// });
		messages.push({
			username: client.username,
			message: msg
		});
		if(messages.length>20){
			messages.shift();
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