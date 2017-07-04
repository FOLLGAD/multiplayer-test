const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });

const shortid = require("shortid");
const vector = require("./vector");
const player = require("./player");

const config = require("./config.json");

let inQueue = new Set();

let gamesessions = new Set();

function broadcast(clients, message) {
	let newmsg = Object.assign({}, message);
	delete newmsg.clients;
	let msg = JSON.stringify(newmsg);
	setTimeout(function () {
		clients.forEach(cl => {
			try {
				cl.send(msg);
			} catch (err) {
				clients.splice(clients.indexOf(cl), 1);
			}
		})
	}, latency)
}

let maps = {
	1: {
		width: 100,
		height: 100
	},
	2: {
		width: 200,
		height: 300
	}
}

class Game {
	constructor({ clients, players, id, map = maps[1] }) {
		this.players = players;
		this.map = map;
		this.id = id;
		this.clients = clients;
	}
	updateGameState() {
		broadcast(this.clients, { type: "gamestate", data: this.getInfo() });
		setTimeout(this.updateGameState.bind(this), 30);
	}
	start() {
		this.updateGameState();
	}
	update() {
		this.players.forEach(pl => {
			pl.pos.add(pl.vel);
		})
	}
	getInfo() {
		return { players: this.players, map: this.map };
	}
}

function initGame(clients) {
	let players = clients.map(pl => {
		return new player({ pos: new vector(0, 0), id: pl.id });
	});
	let game = new Game({ clients, players: players, id: shortid.generate() });
	clients.forEach(cl => {
		cl.game = game;
	})
	return game;
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

wss.on("connection", function (ws) {
	ws.id = shortid.generate();
	ws.send(JSON.stringify({ type: "id", data: ws.id }));
	inQueue.add(ws);

	if (inQueue.size >= 2) {
		let game = initGame(Array.from(inQueue));
		gamesessions.add(game);
		inQueue = new Set();
		broadcast(game.clients, { type: "initgame", data: game.getInfo() });
		game.start();
	}

	ws.on("message", function (message) {
		setTimeout(function () {
			let data = JSON.parse(message);
			switch (data.type) {
				case "playerupdate":
					let pl = findObjectWithPropertyInArray(ws.game.players, "id", data.data.id);
					if (!pl) return;
					pl.pos = data.data.pos;
					pl.vel = data.data.vel;
					break;
			}
		}, latency)
	});

	ws.on("close", function () {
		inQueue.delete(ws);
		console.log(inQueue)
	})
});