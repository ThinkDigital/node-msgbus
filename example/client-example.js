if (process.argv.length < 4) {
	console.log("Usage: client-example.js <bind> <client-id>");
	process.exit(1);
}

var msgbus = require(__dirname + "/../lib/msgbus"),
    iface = process.argv[2],
    id = process.argv[3],
    client = msgbus.createClient();

client.connect(iface, function (err) {
	if (err) {
		console.log("MsgBus client failed to bind");
		console.dir(err);
		return;
	}
	client.identify(id);
});
client.on("broadcast", function (from, msg) {
	console.log("[%s] broadcast from %s:", this.id, from, msg);
});
client.on("error", function (err) {
	console.log("[%s] error: %s", this.id, err.message);
	process.exit(1);
});

setTimeout(function () {
	sendBroadcast();
}, Math.round(Math.random() * 1000));

setTimeout(function () {
	//client.close();
	process.exit(0);
}, Math.round(Math.random() * 10) * 10000);

function sendBroadcast() {
	var msg = {};
	msg[id] = "hello";

	client.broadcast(msg);
	
	setTimeout(function () {
		sendBroadcast();
	}, Math.round(Math.random() * 4000));
}
