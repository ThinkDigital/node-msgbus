var net = require("net"), fs = require("fs");
var Server = function (opts) {
	this.opts = opts;
	this.clients = [];
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
	var self = this;

	client._id = null;
	client._buffer = "";

	client.on("data", function (data) {
		self.processData(client, data);
	});
	client.on("close", function (had_error) {
		self.onClose(client, had_error);
	});
};
Server.prototype.onClose = function (client, error) {
	if (!client._id) return;
	if (!this.clients.hasOwnProperty(client._id)) return;

	console.log("[SERVER] %s closed", client._id);

	delete this.clients[client._id];
};
Server.prototype.processData = function (client, data) {
	if (!client) return;

	client._buffer += String(data);
	
	while ((p = client._buffer.indexOf("\n")) >= 0) {
		var msg = client._buffer.substr(0, p);
		client._buffer = client._buffer.substr(p + 1);
		
		if (msg.length > 0) {
			try {
				msg = JSON.parse(msg);
				
				this.processMessage(client, msg);
			} catch (e) {
				return;
			}
		}
	}
};
Server.prototype.processMessage = function (client, msg) {
	if (msg.hasOwnProperty("identify")) {
		if (!this.clients.hasOwnProperty(msg.identify)) {
			this.clients[msg.identify] = {
				"client"	: client
			};
			client._id = msg.identify;
			console.log("client '%s' is online", msg.identify);
		}
		return;
	}
	if (msg.hasOwnProperty("reply") && msg.reply.length) {
		var client_id = msg.reply[0], msg_id = msg.reply[1];
		
		console.log("[SERVER] (reply to %s.%s)", client_id, msg_id, msg.msg);
		
		if (this.clients.hasOwnProperty(client_id)) {
			this.clients[client_id].client.write(JSON.stringify({ "reply": msg_id, "msg": msg.msg }) + "\n");
		}
		return;
	}
	if (msg.hasOwnProperty("broadcast") && client._id) {
		console.log("[SERVER] (broadcast %s)", client._id, msg.broadcast);
		
		msg.from = client._id;
		
		for (id in this.clients) {
			if (id == client._id) continue;
			if (!this.clients.hasOwnProperty(id)) continue;
			
			console.log("[SERVER] broadcasting to %s..", id);
			
			this.clients[id].client.write(JSON.stringify(msg) + "\n");
		}
	}
};
exports.Server = Server;
