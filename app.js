var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var numClients = 0;

app.get('/', function(req, res){
	res.sendfile('index.html');
});

io.sockets.on('connection', function(client){
	client.on('signin', function(name){
		client.username = name;
		console.log(name + " joined the chat");
		client.broadcast.emit('connection', name);
		numClients++;
		client.id = numClients;
	});
	client.on('chat message', function(msg){
		console.log('message: ' + msg);
		client.broadcast.emit('chat message', msg, client.username);
		client.broadcast.emit('finished typing', client.username);
	});
	client.on('disconnect', function(){
		console.log(client.username + " disconnected");
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