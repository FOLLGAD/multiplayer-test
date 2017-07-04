const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });

const shortid = require("shortid");
const vector = require("./vector");
const player = require("./player");
const Game = require("./game");

const config = require("./config.json");
console.log(config)

let gamesession;

function initGame(clients) {
	let players = clients.map(pl => {
		return new player({ pos: new vector(0, 0), id: pl.id });
	});
	return new Game({ players: players, id: shortid.generate() });
}

function findObjectWithPropertyInArray(array, key, value) {
	return array.filter(ar => {
		return ar[key] == value;
	})[0];
}

let latency = 0;
if (config.dev && config.latency) {
	latency = config.latency;
}

function broadcast(server, message) {
	setTimeout(function () {
		server.clients.forEach(cl => {
			cl.send(JSON.stringify(message));
		})
	}, latency)
}

function updateGameState() {
	broadcast(wss, { type: "gamestate", data: gamesession });
	setTimeout(updateGameState, 30);
}

wss.on("connection", function (ws) {
	ws.id = shortid.generate();
	ws.send(JSON.stringify({ type: "id", data: ws.id }));

	if (wss.clients.size >= 2) {
		gamesession = initGame(Array.from(wss.clients));
		broadcast(wss, { type: "initgame", data: gamesession });
		updateGameState();
	}

	ws.on("message", function (message) {
		setTimeout(function () {
			let data = JSON.parse(message);
			switch (data.type) {
				case "playerupdate":
					let pl = findObjectWithPropertyInArray(gamesession.players, "id", data.data.id);
					if (!pl) return;
					pl.pos = data.data.pos;
					pl.vel = data.data.vel;
					break;
			}
		}, latency)
	});
});