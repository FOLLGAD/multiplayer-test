let config = require("./config.json");

let WebSocket = require("ws"),
	wss = new WebSocket.Server({ port: config.port }),
	fs = require("fs");

let shortid = require("shortid"),
	vector = require("./vector"),
	player = require("./player");

let gamesessions = new Set();

let latency = 0;

if (config.dev && config.latency) {
	latency = config.latency;
}

let maps

fs.readdir("./maps", function (err, mapnames) {
	maps = mapnames
		.filter(f => /\.json$/.test(f))
		.map(f => {
			let dir = "./maps/" + f
			return JSON.parse(fs.readFileSync(dir, "utf-8"))
		})
})

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

class Game {
	constructor() {
		this.map = maps[Math.random() * maps.length | 0]
		this.id = shortid.generate()
		this.players = []
		this.maxPlayers = 5
		this.bullets = []
	}
	init() {
		this.bullets = []
	}
	changeMap(map) {
		this.map = map;
		return this
	}
	spawn(player) {
		let spawnpoint

		if (!this.map.spawnpoints || this.map.spawnpoints.length === 0) {
			spawnpoint = { x: 0, y: 0 }
		} else {
			spawnpoint = this.map.spawnpoints[Math.random() * this.map.spawnpoints.length | 0]
		}

		// Choose a spawnpoint without enemies nearby etc.

		player.spawn(spawnpoint.x, spawnpoint.y)
	}
	clientJoin(client) {
		let myplayer = new player({ client })
		this.players.push(myplayer)

		let players = this.filterPlayer(myplayer)
			.map(player => player.toObject())

		let sendplayer = myplayer.toObject()

		client.godSend("game-setup", { players: players, player: sendplayer, map: this.map });

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
		setTimeout(this.updateGameState.bind(this), config.tickMs)

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

				try {
					// Send
					player.client.godSend("gamestate", { time: this.lastUpdate, players: players, player: player.toBare(), bullets: this.bullets });
				} catch (err) {
					console.error(err)
				}
			})
	}
	start() {
		// Start the updating
		this.updateGameState();
		return this
	}
	update(delta) {
		this.bullets.forEach((bullet, index) => {
			moveProjectile(bullet, delta)
			this.checkProjectileCollision(bullet, index)
		})
		let players = this.players.filter(pl => !pl.dead)

		for (let i = 0; i < this.bullets.length; i++) {
			let bullet = this.bullets[i]

			for (let p = 0; p < players.length; p++) {
				let player = players[p]

				if (player.id == bullet.owner) continue;

				let colx = bullet.pos.x + bullet.radius > player.pos.x
					&& bullet.pos.x - bullet.radius < player.pos.x + player.size,
					coly = bullet.pos.y + bullet.radius > player.pos.y
						&& bullet.pos.y - bullet.radius < player.pos.y + player.size;

				if (colx && coly) {
					this.bullets.splice(i, 1)
					player.harm(bullet.damage)
				}
			}
		}
	}
	checkProjectileCollision(bullet, index) {
		let map = this.map
		for (let i = 0; i < map.tiles.length; i++) {
			let tile = map.tiles[i]

			let colx = bullet.pos.x + bullet.radius > tile.x
				&& bullet.pos.x - bullet.radius < tile.x + tile.scale,
				coly = bullet.pos.y + bullet.radius > tile.y
					&& bullet.pos.y - bullet.radius < tile.y + tile.scale;

			if ((bullet.pos.x < 0 || bullet.pos.x > map.width || bullet.pos.y < 0 || bullet.pos.y > map.height) ||
				colx && coly) {
				this.bullets.splice(index, 1)
				return
			}
		}
	}
	shootBullet(position, target, player, aheadStart = 0) {
		let bulletsize = 8

		let bullet = {
			pos: new vector(position.x, position.y),
			dir: Math.atan2(target.y - position.y, target.x - position.x),
			damage: 50,
			speed: 0.8,
			radius: bulletsize,
			owner: player.id
		}

		moveProjectile(bullet, aheadStart)

		this.bullets.push(bullet)
	}
	movePlayer(player, input) {
		if (input.vdt > 1 || input.vdt < -1 || input.hdt > 1 || input.hdt < -1) return

		let scalar = input.hdt !== 0 && input.vdt !== 0 ? 0.7 : 1

		player.lastPos.x = player.pos.x
		player.pos.x += player.speed * input.delta * scalar * input.hdt

		this.checkCollision(player, "x")

		player.lastPos.y = player.pos.y
		player.pos.y += player.speed * input.delta * scalar * input.vdt

		this.checkCollision(player, "y")

		player.pos.x = Math.floor(player.pos.x)
		player.pos.y = Math.floor(player.pos.y)

		player.isn = input.isn
	}
	checkCollision(player, way) {
		let map = this.map

		if (player.pos.x + player.size > map.width) player.pos.x = map.width - player.size
		else if (player.pos.x < 0) player.pos.x = 0
		if (player.pos.y + player.size > map.height) player.pos.y = map.height - player.size
		else if (player.pos.y < 0) player.pos.y = 0

		for (let i = 0; i < map.tiles.length; i++) {
			let tile = map.tiles[i];
			if (tile.x < player.pos.x + player.size && tile.x + tile.scale > player.pos.x &&
				tile.y < player.pos.y + player.size && tile.y + tile.scale > player.pos.y) {
				if (player.lastPos[way] + player.size <= tile[way]) {
					player.pos[way] = tile[way] - player.size
				} else {
					player.pos[way] = tile[way] + tile.scale
				}
			}
		}
	}
}

function moveProjectile(projectile, delta) {
	projectile.pos.x += Math.cos(projectile.dir) * projectile.speed * delta
	projectile.pos.y += Math.sin(projectile.dir) * projectile.speed * delta
}

function createGame() {
	let newgame = new Game()
	gamesessions.add(newgame)
	newgame.start()
	return newgame
}

wss.on("connection", function (client) {
	client.godSend = function (type, data) {
		let info = { type, data }
		client.send(JSON.stringify(info))
	}

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
			let parsed = JSON.parse(message),
				type = parsed.type,
				data = parsed.data;

			if (type == "playerupdate") {
				if (myplayer.dead) {
					return
				}

				let lastTime = currentTime
				currentTime = data.time

				myplayer.rotation = data.rotation

				mygame.movePlayer(myplayer, data.input)

				// Force-update playerpos
				// client.godSend("playerpos", { pos: myplayer.pos.toObject(), time: Date.now() })
			} else if (type == "shoot") {
				if (myplayer.dead) {
					return
				}

				let delta = Math.min(data.time - currentTime, 200),
					pos = data.pos;

				if (!data.target || data.target.x == null || data.target.y == null || !pos || pos.x == null || pos.y == null || !data.time) {
					return
				}

				if (delta < 0) {
					delta = 0
				}

				if (myplayer.pos.hypot(pos) > myplayer.speed * delta) {
					pos = myplayer.pos
				}

				let newpos = {
					x: pos.x + myplayer.size / 2,
					y: pos.y + myplayer.size / 2
				}

				mygame.shootBullet(
					newpos,
					data.target,
					myplayer,
					delta
				)
			} else if (type == "spawn") {
				mygame.spawn(myplayer)
				client.godSend("playerpos", { pos: myplayer.pos.toObject(), time: Date.now() })
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

function PrintSessions(delay) {
	console.log("Sessions:", gamesessions.size);
	delay && setTimeout(PrintSessions, delay);
}

config.printSessions && PrintSessions(5000)

console.log("Multiplayer-test running on port", config.port)