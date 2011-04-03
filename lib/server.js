var net = require("net"),
    fs = require("fs"),
    util = require("util"),
    events = require("events");

/**
 * Message Bus Server
 *
 * <opts> is optional and should be a key=value object. The only
 * supported key for now is "debug" (boolean, defaults to false).
 **/
var Server = function (opts) {
	events.EventEmitter.call(this);

	opts = opts || {};

	this.debug = opts.debug || false;
	this.allowGuests = opts.allowGuests;
	this.clients = [];
	this.accounts = {};
};

// extend Server to emit events
util.inherits(Server, events.EventEmitter);

/**
 * Add a server account. This means that when a client tries to
 * use <id>, it will have to provide the associated <password>
 * or else it will have to use another <id>.
 *
 * @usage addAccount(<id>, <password>)
 * @usage addAccount({ <id>: <password>, ... })
 **/
Server.prototype.addAccount = function () {
	if (arguments.length == 0) return this;

	if (typeof arguments[0] == "object") {
		for (k in arguments[0]) {
			if (arguments[0].hasOwnProperty(k)) {
				this.addAccount(k, arguments[0][k]);
			}
		}
		return this;
	}
	if (arguments.length == 1) return this;

	this.accounts[arguments[0]] = arguments[1];
	return this;
};

/**
 * Bind the server to an <iface> (interface). This <iface>
 * can be a unix socket path, a tcp port number, an IPv4/6
 * or an IPv4/6:port. Default port is 9009.
 **/
Server.prototype.bind = function (iface, cb) {
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

	try {
		this.socket = net.createServer(function (cli) {
			self.onConnection(cli);
		});
	} catch (e) {
		return cb(e);
	}

	if (net.isIP(host) || iface == null) {
		// tcp socket
		try {
			this.socket.listen(port, host, function () {
				self.__debug("server", "is now online");
				return cb(null);
			});
		} catch (e) {
			cb(e);
		}
	} else {
		// unix socket
		try {
			this.socket.listen(iface, function () {
				self.__debug("server", "is now online");
				return cb(null);
			});
		} catch (e) {
			cb(e);
		}
	}
	return;
};

/**
 * Method that is called for every client connection.
 **/
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

/**
 * Method that is called for every client that closes connection.
 **/
Server.prototype.onClose = function (client, error) {
	if (!client._id) return;
	if (!this.clients.hasOwnProperty(client._id)) return;

	this.__debug(client._id, "is now offline");
	this.emit("offline", client._id);

	delete this.clients[client._id];
};

/**
 * Processes client data into a buffer. If the buffer has one
 * or more messages, those are extracted and sent to processMessage().
 **/
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

/**
 * Processes client messages.
 **/
Server.prototype.processMessage = function (client, msg) {
	if (msg.hasOwnProperty("identify")) {
		if (!this.clients.hasOwnProperty(msg.identify)) {
			if (this.accounts.hasOwnProperty(msg.identify)) {
				// account is registed, need password
				if (msg.pwd != this.accounts[msg.identify]) {
					this.__write(client, {
						"reply"	: msg._id || null,
						"msg"	: {
							"error"	: {
								"number"	: 2,
								"message"	: "Access denied"
							}
						}
					});
					return;
				}
			} else if (!this.allowGuests) {
				this.__write(client, {
					"reply"	: msg._id || null,
					"msg"	: {
						"error"	: {
							"number"	: 3,
							"message"	: "Access denied. Guests not allowed"
						}
					}
				});
				return;
			}
			this.clients[msg.identify] = {
				"client"	: client
			};
			client._id = msg.identify;

			this.__write(client, {
				"reply"	: msg._id || null,
				"msg"	: {
					"id"	: client._id
				}
			});

			this.__debug(client._id, "is now online");
			this.emit("online", client._id);
		} else {
			this.__write(client, {
				"reply"	: msg._id || null,
				"msg"	: {
					"error"	: {
						"number"	: 1,
						"message"	: "Client already signed on"
					}
				}
			});
		}
		return;
	}

	// a client without identification cannot do anything else
	if (!client._id) return;

	if (msg.hasOwnProperty("reply") && msg.reply.length) {
		var client_id = msg.reply[0], msg_id = msg.reply[1];

		//console.log("[SERVER] (reply to %s.%s)", client_id, msg_id, msg.msg);

		if (this.clients.hasOwnProperty(client_id)) {
			this.__write(this.clients[client_id].client, { "reply": msg_id, "msg": msg.msg });
		}
		return;
	}
	if (msg.hasOwnProperty("broadcast")) {
		this.__debug(client._id, "broadcast:", msg.broadcast);
		this.emit("broadcast", client._id, msg.broadcast);
		
		msg.from = client._id;
		
		for (id in this.clients) {
			if (id == client._id) continue;
			if (!this.clients.hasOwnProperty(id)) continue;

			// sending to everyone else except this client
			this.__write(this.clients[id].client, msg);
		}
		return;
	}
	if (msg.hasOwnProperty("to") && msg.to != null) {
		this.__debug(client._id, "to: %s msg: ", msg.to, msg.msg);
		this.emit("message", client._id, msg.to, msg.msg);
		
		if (this.clients.hasOwnProperty(msg.to)) {
			this.__write(this.clients[msg.to].client, {
				"from"	: client._id,
				"msg"	: msg.msg
			});
		} else {
			this.__write(client, {
				"reply"	: msg._id || null,
				"msg"	: {
					"error"	: {
						"number"	: 2,
						"message"	: "Client not found"
					}
				}
			});
		}
		return;
	}
};

/**
 * Write <data> object to a specific <client> socket. If any errors
 * occurs, it emits 'error' event with the error as the only argument.
 *
 * @access private
 **/
Server.prototype.__write = function (client, data) {
	try {
		client.write(JSON.stringify(data) + "\n");
	} catch (e) {
		this.emit("error", e);
	}
};

/**
 * Writes some debug messages if debug is turned on. You can enable
 * debug by sending if in the constructor options ( { debug: true } ).
 **/
Server.prototype.__debug = function () {
	if (!this.debug) return;
	var args = [];

	args[0] = "[server/" + arguments[0] + "] " + arguments[1];

	for (var i = 2; i < arguments.length; i++) {
		args.push(arguments[i]);
	}
	console.log.apply(this, args);
};

// export Server class
exports.Server = Server;
