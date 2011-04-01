if (process.argv.length < 3) {
	console.log("Usage: server-example.js <bind>");
	process.exit(1);
}

var msgbus = require(__dirname + "/../lib/msgbus"),
    server = msgbus.createServer(),
    iface = process.argv[2];

server.bind(iface, function (err) {
	if (err) {
		console.log("MsgBus server failed to bind");
		console.dir(err);
		return;
	}
	console.log("MsgBus server binded to %s", iface);
});
