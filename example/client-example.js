if (process.argv.length < 4) {
	console.log("Usage: client-example.js <bind> <client-id> [<password>]");
	process.exit(1);
}

var msgbus = require(__dirname + "/../lib/msgbus"),
    iface = process.argv[2],
    id = process.argv[3],
    client = msgbus.createClient({ "debug": true });

client.connect(iface, function (err) {
	if (err) {
		console.log("MsgBus client failed to bind");
		console.dir(err);
		return;
	}
	if (process.argv.length > 4) {
		client.identify(id, process.argv[4]);
	} else {
		client.identify(id);
	}
});
client.on("broadcast", function (from, msg, msg_id) {
	//console.log("[%s] broadcast from %s:", this.id, from, msg);
	
	// reply from time to time
	if (Math.random() > 0.7) {
		client.reply(from, msg_id, { reply: from });
	} else if (Math.random() > 0.7) {
		client.send(from, { "msg": "hello to from " + this.id + " to " + from });
	}
});
client.on("message", function (from, msg, msg_id) {
	//console.log("[%s] message from %s:", this.id, from, msg);
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
}, (Math.round(Math.random() * 10) + 10) * 1000); // wait between 10 and 20secs before stopping

function sendBroadcast() {
	client.broadcast({ "msg": "hello from " + id }, checkResponse);
	
	setTimeout(function () {
		sendBroadcast();
	}, Math.round(Math.random() * 4000));
}

function checkResponse(msg) {
	//console.log("[%s] reply:", client.id, msg);
}
