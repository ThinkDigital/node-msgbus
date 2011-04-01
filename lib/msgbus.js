exports.createServer = function (opts) {
	var server = require(__dirname + "/server");
	
	return new(server.Server)(opts);
};
exports.createClient = function (opts) {
	var client = require(__dirname + "/client");
	
	return new(client.Client)(opts);
};
