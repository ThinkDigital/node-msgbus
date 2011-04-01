if (process.argv.length < 3) {
	console.log("Usage: server-example.js <bind>");
	process.exit(1);
}

var msgbus = require(__dirname + "/../lib/msgbus"),
    server = msgbus.createServer({ "debug": true }),
    iface = process.argv[2];

server.addAccount("client1", "password");

server.bind(iface, function (err) {
	if (err) {
		console.log("MsgBus server failed to bind");
		console.dir(err);
		return;
	}
});
server.on("online", function (id) {
	//console.log("client %s is now online", id);
});
server.on("offline", function (id) {
	//console.log("client %s is now offline", id);
});
server.on("broadcast", function (id, msg) {
	//console.log("client %s broadcast: ", id, msg);
});
