var msgbus = require(__dirname + "/../lib/msgbus"),
    server = msgbus.createServer(),
    iface = "msgbus.sock";
var clients = [], totalClients = 5;

server.bind(iface, function (err) {
	if (err) {
		console.log("MsgBus server failed to bind");
		console.dir(err);
		return;
	}
	console.log("MsgBus server binded to %s", iface);
	
	for (var i = 0; i < totalClients; i++) {
		clients[i] = msgbus.createClient();
		
		clients[i].connect(iface, function (err) {
			if (err) {
				console.log("MsgBus client failed to bind");
				console.dir(err);
				return;
			}
		});
		clients[i].on("broadcast", function (from, msg) {
			console.log("[%s] broadcast from %s:", this.id, from, msg);
		});
	}
	
	setTimeout(function () {
		for (var i = 0; i < totalClients; i++) {
			clients[i].identify("client"+(i+1));
		}
	}, 1000);
	
	setTimeout(function () {
		clients[2].broadcast({ hello: "world" });
	}, 2000);
});
