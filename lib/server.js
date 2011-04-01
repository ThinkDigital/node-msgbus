var net = require("net"), fs = require("fs");
var Server = function (opts) {
	this.opts = opts;
	this.clients = [];
	this.clientIds = [];
};
Server.prototype.bind = function (iface, cb) {
	if (typeof cb != "function") {
		throw { "number": 1, "message": "Argument 2 must be a callback" };
		return;
	}

	var port = 9009, self = this;

	host = iface.split(":");
	if (host.length > 1) {
		port = host[1];
	}
	host = host[0];
	
	try {
		this.socket = net.createServer(function (cli) {
			self.onConnection(cli);
		});
	} catch (e) {
		return cb(e);
	}

	if (net.isIP(host)) {
		// tcp socket
		try {
			this.socket.listen(port, host, function () {
				return cb(null);
			});
		} catch (e) {
			cb(e);
		}
	} else {
		// unix socket
		try {
			this.socket.listen(iface, function () {
				return cb(null);
			});
		} catch (e) {
			cb(e);
		}
	}
	return;
};
Server.prototype.onConnection = function (client) {
	this.clients.push({
		"client"	: client,
		"buffer"	: "",
		"id"		: null
	});

	var self = this, idx = this.clients.length - 1;

	client.on("data", function (data) {
		self.processData(idx, data);
	});
};
Server.prototype.processData = function (idx, data) {
	if (idx < 0 || idx >= this.clients.length) return;

	this.clients[idx].buffer += String(data);
	
	while ((p = this.clients[idx].buffer.indexOf("\n")) >= 0) {
		var msg = this.clients[idx].buffer.substr(0, p);
		this.clients[idx].buffer = this.clients[idx].buffer.substr(p + 1);
		
		if (msg.length > 0) {
			try {
				msg = JSON.parse(msg);
				
				this.processMessage(idx, msg);
			} catch (e) {
				return;
			}
		}
	}
};
Server.prototype.processMessage = function (idx, msg) {
	if (idx < 0 || idx >= this.clients.length) return;

	if (msg.hasOwnProperty("identify")) {
		if (this.clientIds.indexOf(msg.identify) == -1) {
			this.clientIds.push(msg.identify);
			this.clients[idx].id = msg.identify;
			console.log("client '%s' is online", msg.identify);
		}
	}
	if (msg.hasOwnProperty("broadcast")) {
		console.log("[SERVER] (broadcast %s)", this.clients[idx].id, msg.broadcast);
		
		msg.from = this.clients[idx].id;
		
		for (var i = 0; i < this.clients.length; i++) {
			if (this.clients[i].id == this.clients[idx].id) continue;
			
			this.clients[i].client.write(JSON.stringify(msg) + "\n");
		}
	}
};
exports.Server = Server;
