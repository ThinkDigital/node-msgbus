var net = require("net"),
    fs = require("fs"),
    util = require("util"),
    events = require("events");

/**
 * Message Bus Client
 *
 * <opts> is optional and should be a key=value object. The only
 * supported key for now is "debug" (boolean, defaults to false).
 **/
var Client = function (opts) {
	events.EventEmitter.call(this);

	opts = opts || {};

	this.debug = opts.debug || false;
	this.buffer = "";
	this.replies = {};
};

// extend Client to emit events
util.inherits(Client, events.EventEmitter);

/**
 * Connect to server on <iface> (interface). This <iface>
 * can be a unix socket path, a tcp port number, an IPv4/6
 * or an IPv4/6:port. Default port is 9009.
 **/
Client.prototype.connect = function (iface, cb) {
	if (typeof iface == "function") {
		cb = iface;
		iface = null;
	}

	if (typeof cb != "function") {
		throw { "number": 1, "message": "Argument 2 must be a callback" };
		return;
	}

	var port = 9009, host = "127.0.0.1", self = this;

	if (iface != null) {
		host = iface.split(":");
		if (host.length > 1) {
			port = host[1];
		}
		host = host[0];
	}

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
	this.socket.on("close", function (data) {
		self.emit("close");
	});
};

/**
 * Send client identification. You can specify a password and a callback
 * to check if client was correctly identified. Callback will have an
 * error argument that will be null if everything is ok.
 *
 * @usage identify(<id>)
 * @usage identify(<id>, <callback>)
 * @usage identify(<id>, <password>)
 * @usage identify(<id>, <password>, <callback>)
 * @usage identify(<id>, <callback>, <password>)
 **/
Client.prototype.identify = function () {
	if (arguments.length == 0) {
		throw { "number": 1, "message": "Missing argument" };
		return;
	}

	var self = this,
	    id = arguments[0], pwd = null, cb = null;

	if (arguments.length > 1) {
		switch (typeof arguments[1]) {
			case "function": cb = arguments[1]; break;
			case "string": pwd = arguments[1]; break;
		}
		
		if (arguments.length > 2) {
			switch (typeof arguments[2]) {
				case "function": cb = arguments[1]; break;
				case "string": pwd = arguments[1]; break;
			}
		}
	}

	this.__debug("identifying as %s...", id);
	this.__write({ "identify": id, "pwd": pwd }, function (msg) {
		if (msg.error) {
			self.__debug("identification error: %s", id);
			if (typeof cb == "function") cb(msg.error);
		} else {
			self.id = id;
			self.__debug("successfull identification: %s", id);
			if (typeof cb == "function") cb(null);
		}
		return;
	});

	return;
};

/**
 * Check if client <id> is online. <cb> (callback) is required.
 **/
Client.prototype.online = function (id, cb) {
	if (typeof cb != "function") throw { "code": 1, "message": "client.online() requires a callback" };
	return this.__write({ "online": id }, cb);
};

/**
 * Send a <msg> object to everyone. <cb> (callback) is optional.
 **/
Client.prototype.broadcast = function (msg, cb) {
	return this.__write({ "broadcast": msg }, cb);
};

/**
 * Send a <signal> name to everyone. <cb> (callback) is optional.
 **/
Client.prototype.signal = function (signal, cb) {
	if (typeof signal != "string") return false;
	return this.__write({ "signal": signal }, cb);
};

/**
 * Send a <msg> object to client <id>. <cb> (callback) is optional.
 **/
Client.prototype.send = function (id, msg, cb) {
	return this.__write({ "to": id, "msg": msg }, cb);
};

/**
 * Reply to a <msg_id> message from client <id>. <cb> (callback) is optional.
 **/
Client.prototype.reply = function (id, msg_id, msg, cb) {
	return this.__write({ "reply": [ id, msg_id ], "msg": msg }, cb);
};

/**
 * This is a private method to write data to the socket. If an error
 * occurs it emits 'error' event.
 **/
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

/**
 * Processes a message that comes from the server. It emits:
 *
 * 'broadcast' event: <id> (client), <msg> and <msg_id>
 * 'message' event: <id> (client), <msg> and <msg_id>
 *
 * It also handles replies sent to the client by calling the
 * associated callback.
 **/
Client.prototype.__processMessage = function (msg) {
	if (msg.hasOwnProperty("reply")) {
		if (this.replies.hasOwnProperty(msg.reply)) {
			this.__debug("reply/%s : ", msg.reply, msg.msg);
			this.replies[msg.reply](msg.msg);
			delete this.replies[msg.reply];
		}
		return;
	}
	if (msg.hasOwnProperty("broadcast")) {
		this.__debug("broadcast/%s : %s ->", msg._id, msg.from, msg.broadcast);
		this.emit("broadcast", msg.from || null, msg.broadcast, msg._id || null);
		return;
	}
	if (msg.hasOwnProperty("signal")) {
		this.__debug("signal/%s : %s", msg.signal, msg.from);
		this.emit("signal-" + msg.signal, msg.from, msg._id || null);
		return;
	}
	if (msg.hasOwnProperty("from")) {
		this.__debug("from/%s : ", msg.from, msg.msg);
		this.emit("message", msg.from, msg.msg, msg._id || null);
		return;
	}
	if (msg.hasOwnProperty("offline")) {
		this.__debug("offline/%s", msg.offline);
		this.emit("offline", msg.offline);
		return;
	}
	if (msg.hasOwnProperty("online")) {
		this.__debug("online/%s", msg.online);
		this.emit("online", msg.online);
		return;
	}
};

/**
 * Checks buffer for messages to send to __processMessage().
 **/
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

/**
 * Writes some debug messages if debug is turned on. You can enable
 * debug by sending if in the constructor options ( { debug: true } ).
 **/
Client.prototype.__debug = function () {
	if (!this.debug) return;
	var args = [];

	args[0] = "[client/%s] " + arguments[0];
	args[1] = this.id || "guest";

	for (var i = 1; i < arguments.length; i++) {
		args.push(arguments[i]);
	}
	console.log.apply(this, args);
};

// export Client class
exports.Client = Client;
