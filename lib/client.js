var net = require("net"),
    fs = require("fs"),
    util = require("util"),
    events = require("events");

var Client = function (opts) {
	events.EventEmitter.call(this);

	this.opts = opts || {};
	this.id = this.opts.id || null;
	this.buffer = "";
};

util.inherits(Client, events.EventEmitter);

Client.prototype.connect = function (iface, cb) {
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

	if (net.isIP(host)) {
		// tcp socket
		this.socket = net.createConnection(port, host);
	} else {
		// unix socket
		this.socket = net.createConnection(iface);
	}
	
	this.socket.on("connect", function () {
		cb(null);
	});
	this.socket.on("data", function (data) {
		self.buffer += String(data);
		self.__checkBuffer();
	});
};
Client.prototype.identify = function (id) {
	this.id = id;
	this.socket.write(JSON.stringify({ "identify": id }) + "\n");
};
Client.prototype.broadcast = function (msg) {
	this.socket.write(JSON.stringify({ "broadcast": msg }) + "\n");
};
Client.prototype.__processMessage = function (msg) {
	if (msg.hasOwnProperty("broadcast")) {
		this.emit("broadcast", msg.from || null, msg.broadcast);
	}
};
Client.prototype.__checkBuffer = function () {
	while ((p = this.buffer.indexOf("\n")) >= 0) {
		var msg = this.buffer.substr(0, p);
		this.buffer = this.buffer.substr(p + 1);
		
		if (msg.length > 0) {
			try {
				msg = JSON.parse(msg);
				
				this.__processMessage(msg);
			} catch (e) {
				return;
			}
		}
	}
};
exports.Client = Client;
