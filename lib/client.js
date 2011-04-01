var net = require("net"),
    fs = require("fs"),
    util = require("util"),
    events = require("events");

var Client = function (opts) {
	events.EventEmitter.call(this);

	this.opts = opts || {};
	this.id = this.opts.id || null;
	this.buffer = "";
	this.replies = {};
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
	this.socket.on("error", function (err) {
		cb(err);
	});
	this.socket.on("data", function (data) {
		self.buffer += String(data);
		self.__checkBuffer();
	});
};
Client.prototype.identify = function (id, cb) {
	this.id = id;
	this.__write({ "identify": id }, cb);
};
Client.prototype.broadcast = function (msg, cb) {
	return this.__write({ "broadcast": msg }, cb);
	return;
};
Client.prototype.reply = function (client, id, msg, cb) {
	this.__write({ "reply": [ client, id ], "msg": msg }, cb);
};
Client.prototype.__write = function (data, cb) {
	if (typeof cb == "function") {
		if (!data.hasOwnProperty("_id")) {
			data._id = Math.round(Math.random() * 10000);
		}
		this.replies[data._id] = cb;
	}
	try {
		this.socket.write(JSON.stringify(data) + "\n");
	} catch (e) {
		this.emit("error", e);
	}
};
Client.prototype.__processMessage = function (msg) {
	if (msg.hasOwnProperty("reply")) {
		if (this.replies.hasOwnProperty(msg.reply)) {
			this.replies[msg.reply](msg.msg);
			delete this.replies[msg.reply];
		}
		return;
	}
	if (msg.hasOwnProperty("broadcast")) {
		this.emit("broadcast", msg.from || null, msg.broadcast, msg._id || null);
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
