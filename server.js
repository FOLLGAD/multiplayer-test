let WebSocket = require("ws"),
	wss = new WebSocket.Server({ port: 8080 });

let shortid = require("shortid"),
	vector = require("./vector"),
	player = require("./player");

const config = require("./config.json");

let gamesessions = new Set();

let latency = 0;
if (config.dev && config.latency) {
	latency = config.latency;
}

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
	constructor(map = maps[1]) {
		this.map = map;
		this.id = shortid.generate();
		this.players = [];
		this.maxPlayers = 5;
		this.bullets = [];
	}
	init() {
		this.bullets = []
	}
	changeMap(map) {
		this.map = map;
		return this
	}
	clientJoin(client) {
		let myplayer = new player({ client })
		this.players.push(myplayer)

		let players = this.filterPlayer(myplayer)
			.map(player => player.toObject())

		client.send(JSON.stringify({ type: "gameinfo", players: players, player: myplayer.toObject(), map: this.map }));

		return myplayer
	}
	filterPlayer(players, player) {
		// Shallow copy
		let playersCopy = Array.from(players);

		// Dont send the current client
		for (let i = 0; i < playersCopy.length; i++) {

			// Check if players share the same client
			if (playersCopy[i].id == player.id) {

				// Splice current client's player
				playersCopy.splice(i, 1);
				break;
			}
		}
		return playersCopy
	}
	updateGameState() {
		setTimeout(this.updateGameState.bind(this), 10)

		if (!this.lastUpdate) {
			this.lastUpdate = Date.now()
		} else {
			let newTime = Date.now()
			let delta = newTime - this.lastUpdate

			this.lastUpdate = newTime

			this.sendData()

			// Update physics
			this.update(delta)
		}
	}
	sendData() {
		// Send updated players-positions to every player
		let originalPlayers = Array.from(this.players)
			// Filter out all dead
			.filter(pl => !pl.dead)
			// Make JSON-friendly
			.map(pl => pl.toObject())

		this.players
			.forEach(player => {
				let players = this
					// Filter out self
					.filterPlayer(originalPlayers, player)

				// Send
				player.client.send(JSON.stringify({ type: "gamestate", date: this.lastUpdate, players: players, player: player.toObject(), bullets: this.bullets }));
			})
	}
	start() {
		// Start the updating
		this.updateGameState();
		return this
	}
	update(delta) {
		this.bullets.forEach(bullet => {
			bullet.pos.x += Math.cos(bullet.dir) * bullet.speed * delta
			bullet.pos.y += Math.sin(bullet.dir) * bullet.speed * delta
		})
		let players = this.players.filter(pl => !pl.dead)

		for (let i = 0; i < this.bullets.length; i++) {
			let bullet = this.bullets[i]

			for (let p = 0; p < players.length; p++) {
				let player = players[p]

				if (player.id == bullet.owner) continue;

				let colx = bullet.pos.x + bullet.size > player.pos.x && bullet.pos.x < player.pos.x + player.size,
					coly = bullet.pos.y + bullet.size > player.pos.y && bullet.pos.y < player.pos.y + player.size;

				if (colx && coly) {
					this.bullets.splice(this.bullets.indexOf(bullet), 1)
					player.harm(bullet.damage)
				}
			}
		}
	}
	shootBullet(position, target, player) {
		let bulletsize = 8
		let newpos = {
			x: position.x - bulletsize / 2,
			y: position.y - bulletsize / 2,
		}
		let newtarget = {
			x: target.x - bulletsize / 2,
			y: target.y - bulletsize / 2,
		}
		let bullet = {
			pos: new vector(newpos.x, newpos.y),
			dir: Math.atan2(newtarget.y - newpos.y, newtarget.x - newpos.x),
			// damage: weapons[player.weapon].damage,
			damage: 50,
			speed: 0.8,
			size: bulletsize,
			owner: player.id,
		}
		this.bullets.push(bullet)
	}
}

function createGame() {
	let newgame = new Game()
	gamesessions.add(newgame)
	newgame.start()
	return newgame
}

function findObjectWithPropertyInArray(array, key, value) {
	return array.filter(ar => {
		return ar[key] == value
	})[0];
}

wss.on("connection", function (client) {

	let sessions = Array.from(gamesessions),
		mygame = null,
		myplayer = null,
		currentTime;

	// Find a game for the new client
	for (let i = 0; i < sessions.length; i++) {
		if (sessions[i].maxPlayers > sessions[i].players.length) {
			myplayer = sessions[i].clientJoin(client)
			mygame = sessions[i]
			break
		}
	}

	// Create game if no vacancy is found
	if (null == mygame) {
		let game = createGame()
		myplayer = game.clientJoin(client)
		mygame = game
	}

	client.on("message", function (message) {
		setTimeout(function () {
			let data = JSON.parse(message),
				type = data.type
			if (type == "playerupdate") {
				if (myplayer.dead) {
					return
				}
				if (!currentTime) {
					currentTime = Date.now()
					return
				}
				if (data.time > Date.now()) {
					// Kick player
					return
				}

				let lastTime = currentTime
				currentTime = data.time
				let delta = currentTime - lastTime,
					force = false

				if (delta > 200) {
					delta = 200
					force = true
				}

				movePlayer(myplayer, data.keys, delta)

				let rotation = Math.atan2(data.target.y - myplayer.pos.y - myplayer.size / 2, data.target.x - myplayer.pos.x - myplayer.size / 2)
				myplayer.rotation = rotation

				if (force) {
					client.send(JSON.stringify({ type: "playerpos", pos: myplayer.pos.toObject(), time: Date.now() }))
				}
			} else if (type == "shoot") {
				if (myplayer.dead) {
					return
				}
				let delta = Math.max(data.time - currentTime, 200),
					pos = data.pos;
				if (delta < 0) {
					delta = 0
				}
				if (!data.target || data.target.x == null || data.target.y == null || !pos || pos.x == null || pos.y == null || !data.time) {
					return
				}
				if (myplayer.pos.hypot(pos) > myplayer.speed * delta) {
					pos = myplayer.pos
				}
				pos.x += myplayer.size / 2
				pos.y += myplayer.size / 2
				mygame.shootBullet(pos, data.target, myplayer)
			} else if (type == "spawn") {
				myplayer.spawn()
				client.send(JSON.stringify({ type: "playerpos", pos: myplayer.pos.toObject(), time: Date.now() }))
			}
		}, latency)
	});

	client.on("close", function () {
		mygame.players.splice(mygame.players.indexOf(myplayer), 1);
		if (mygame.players.length <= 0) {
			gamesessions.delete(mygame)
		}
	})
});

function movePlayer(player, keys, delta) {
	let scalar = (keys.right || keys.left) && (keys.up || keys.down) ? 0.7 : 1

	for (let i = 0; i < delta; i++) {

		if (keys.right !== keys.left) {
			if (keys.right) {
				player.vel.x = 1 * scalar
				player.pos.x += player.speed * scalar
			} else {
				player.vel.x = -1 * scalar
				player.pos.x -= player.speed * scalar
			}
		} else {
			player.vel.x = 0
		}
		if (keys.down !== keys.up) {
			if (keys.down) {
				player.vel.y = 1 * scalar
				player.pos.y += player.speed * scalar
			} else {
				player.vel.y = -1 * scalar
				player.pos.y -= player.speed * scalar
			}
		} else {
			player.vel.y = 0
		}
	}
}

!function PrintRooms() {
	console.log("Sessions:", gamesessions.size);
	setTimeout(PrintRooms, 5000);
}()