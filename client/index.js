let socket,
	player,
	dead = true,
	gamestate = {
		players: [],
		bullets: [],
		mybullets: [],
		map: null,
	},
	playerInputs = [],
	inputNumber = 0,
	currentTime = null;

let canvas = document.createElement("canvas"),
	ctx = canvas.getContext("2d");

function showScreen(screen) {
	if (screen == "game_menu") {
		main_menu.style.display = "none"
		game_menu.style.display = "block"
	} else if (screen == "main_menu") {
		main_menu.style.display = "block"
		game_menu.style.display = "none"
	} else if (screen == "game_canvas") {
		main_menu.style.display = "none"
		game_menu.style.display = "none"
	}
}

function emit(type, data) {
	let info = { type: type }
	if (data) info.data = data
	socket.send(JSON.stringify(info))
}

function resize() {
	canvas.width = window.innerWidth
	canvas.height = window.innerHeight
}

document.addEventListener("DOMContentLoaded", function () {
	document.body.appendChild(canvas)

	window.addEventListener("resize", resize)
	resize()

	let game_menu = document.getElementById("game_menu"),
		main_menu = document.getElementById("main_menu"),
		connect_btn = document.getElementById("connect_btn"),
		spawn_btn = document.getElementById("spawn_btn");

	connect_btn.addEventListener("click", connect)

	spawn_btn.addEventListener("click", spawn)
});

function spawn() {
	emit("spawn")
}

function addVectors(base, add) {
	let x = base.x + add.x
	let y = base.y + add.y

	return { x, y }
}

function multiplyVector(vector, scalar) {
	return {
		x: vector.x * scalar,
		y: vector.y * scalar,
	}
}

function updatePos(delta) {
	if (player && !dead) {
		let input = {
			delta: delta,
			vdt: 0,
			hdt: 0,
			rotation: player.rotation,
			isn: inputNumber++,
		}

		if (keys.right !== keys.left) {
			input.hdt = keys.right ? 1 : -1
		}
		if (keys.down !== keys.up) {
			input.vdt = keys.down ? 1 : -1
		}

		playerInputs.push(input)

		movePlayer(player, input)

		player.rotation = Math.atan2(mouse.y - player.pos.y - player.size / 2, mouse.x - player.pos.x - player.size / 2)

		sendInput(input)
	}
}

function sendInput(input) {
	emit("playerupdate", { input: input, rotation: player.rotation, time: Date.now() })
}

function movePlayer(player, input) {
	if (input.vdt > 1 || input.vdt < -1 || input.hdt > 1 || input.hdt < -1) return

	let scalar = input.hdt !== 0 && input.vdt !== 0 ? 0.7 : 1

	player.lastPos.x = player.pos.x
	player.pos.x += player.speed * input.delta * scalar * input.hdt

	checkCollision(player, "x")

	player.lastPos.y = player.pos.y
	player.pos.y += player.speed * input.delta * scalar * input.vdt

	checkCollision(player, "y")

	player.isn = input.isn
}

function checkCollision(player, way) {
	if (player.pos.x > gamestate.map.width) player.pos.x = gamestate.map.width
	else if (player.pos.x < 0) player.pos.x = 0
	if (player.pos.y > gamestate.map.height) player.pos.y = gamestate.map.height
	else if (player.pos.y < 0) player.pos.y = 0

	for (let i = 0; i < gamestate.map.tiles.length; i++) {
		let tile = gamestate.map.tiles[i];
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

function shootBullet() {
	if (dead || player.pos.x == null || player.pos.y == null || mouse.x == null || mouse.y == null) {
		return
	}

	let time = Date.now()
	emit("shoot", {
		pos: player.pos,
		target: mouse,
		time: time,
	})

	let bulletsize = 8
	let newpos = {
		x: player.pos.x - bulletsize / 2 + player.size / 2,
		y: player.pos.y - bulletsize / 2 + player.size / 2,
	}
	let newtarget = {
		x: mouse.x - bulletsize / 2,
		y: mouse.y - bulletsize / 2,
	}
	let bullet = {
		pos: newpos,
		dir: Math.atan2(newtarget.y - newpos.y, newtarget.x - newpos.x),
		// damage: weapons[player.weapon].damage,
		damage: 50,
		speed: 0.8,
		size: bulletsize,
		owner: player.id,
	}
	gamestate.mybullets.push(bullet)
}

function onopen() {
	showScreen("game_menu")
	initialize()
}

function onmessage(message) {
	let parsed = JSON.parse(message.data),
		type = parsed.type,
		data = parsed.data;

	switch (type) {
		case "game-setup":
			gamestate.map = data.map
			gamestate.players = data.players
			player = data.player
			loop()
			break
		case "gamestate":
			gamestate.players = data.players
			gamestate.bullets = data.bullets

			player.pos.x = data.player.pos.x
			player.pos.y = data.player.pos.y
			player.health = data.player.health
			player.isn = data.player.isn

			move()
			break
		case "playerpos":
			player.pos.x = data.pos.x
			player.pos.y = data.pos.y
			currentTime = data.time
			dead = false
			showScreen("game_canvas")
			break
		case "die":
			player.pos.x = undefined
			player.pos.y = undefined
			dead = true
			showScreen("game_menu")
			break
	}
}

function onclose() {
	setTimeout(connect, 1000)
}

function initialize() {
	dead = true
	gamestate = {
		players: [],
		bullets: [],
		mybullets: [],
	}
	playerInputs = []
	inputNumber = 0
	currentTime = null
}

function connect() {
	socket = new WebSocket("ws://192.168.1.20:80")
	socket.onopen = onopen
	socket.onmessage = onmessage
	socket.onclose = onclose
}

function move() {
	for (let i = 0; i < playerInputs.length; i++) {
		let inp = playerInputs[i]
		if (inp.isn <= player.isn) {
			playerInputs.splice(i, 1)
			i--
		} else {
			movePlayer(player, playerInputs[i])
		}
	}
}

const keys = {
	up: false,
	down: false,
	right: false,
	left: false,
	shooting: false,
};

let keyBinds = {
	"KeyW": "up",
	"KeyS": "down",
	"KeyD": "right",
	"KeyA": "left",
}

// For lag testing

let LAGSWITCH = false

document.addEventListener("keydown", function (e) {
	if (e.code == "Backquote") {
		LAGSWITCH = true
	}
	let bind = keyBinds[e.code]
	bind && (keys[bind] = true)
})
document.addEventListener("keyup", function (e) {
	let bind = keyBinds[e.code]
	bind && (keys[bind] = false)
})

let mouse = { x: undefined, y: undefined }

document.addEventListener("mousemove", function (e) {
	mouse.x = e.clientX
	mouse.y = e.clientY
})
document.addEventListener("contextmenu", e => e.preventDefault())
document.addEventListener("mousedown", shootBullet)
// document.addEventListener("mouseup", function (e) {
// 	keys.shooting = false
// })

let clientsmoothing = true

function draw(delta) {
	ctx.clearRect(0, 0, canvas.width, canvas.height)

	let packetDelta = 0

	gamestate.players.forEach(drawPlayer => {
		let newpos

		// if (clientsmoothing && packetDelta) {
		// newpos = addVectors(drawPlayer.pos, multiplyVector(drawPlayer.vel, packetDelta * drawPlayer.speed))
		// } else {
		newpos = drawPlayer.pos
		// }

		ctx.translate(newpos.x + drawPlayer.size / 2, newpos.y + drawPlayer.size / 2)
		ctx.rotate(drawPlayer.rotation)
		ctx.fillStyle = drawPlayer.color
		ctx.fillRect(-drawPlayer.size / 2, -drawPlayer.size / 2, drawPlayer.size, drawPlayer.size)
		ctx.rotate(-drawPlayer.rotation)
		ctx.translate(-newpos.x - drawPlayer.size / 2, -newpos.y - drawPlayer.size / 2)
	})

	gamestate.map.tiles.forEach(tile => {
		ctx.fillStyle = "#333"
		ctx.fillRect(tile.x, tile.y, tile.scale, tile.scale)
	})

	if (!dead) {
		ctx.translate(player.pos.x + player.size / 2, player.pos.y + player.size / 2)
		ctx.rotate(player.rotation)
		ctx.fillStyle = player.color
		ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size)
		ctx.rotate(-player.rotation)
		ctx.translate(-player.pos.x - player.size / 2, -player.pos.y - player.size / 2)

		// Health bar
		let percentage = player.health / 100
		ctx.fillStyle = "rgb(80, 240, 20)"
		ctx.fillRect(player.pos.x + player.size / 2 - ((player.size / 2) * percentage), player.pos.y - 10, player.size * percentage, 10)
	}

	// Draw cursor
	// if (mouse.x != void 0 && mouse.y != void 0) {
	// 	ctx.fillStyle = "rgb(80, 80, 80)"
	// 	let w = 10
	// 	ctx.fillRect(mouse.x - w / 2, mouse.y - w / 2, w, w)
	// }

	for (let i = 0; i < gamestate.bullets.length; i++) {
		let bullet = gamestate.bullets[i]

		if (player.id == bullet.owner) continue

		let visbullet = moveProjectile(bullet, packetDelta)

		drawBullet(visbullet, bullet)
	}
	for (let i = 0; i < gamestate.mybullets.length; i++) {
		let bullet = gamestate.mybullets[i]

		let newpos = moveProjectile(bullet, delta)

		bullet.pos.x = newpos.x
		bullet.pos.y = newpos.y

		drawBullet(newpos, bullet)
	}
}

function drawBullet(visbullet, bullet) {
	ctx.fillStyle = "rgb(12, 12, 0)"
	ctx.fillRect(visbullet.x, visbullet.y, bullet.size, bullet.size)
}

function moveProjectile(projectile, delta) {
	let x = projectile.pos.x + Math.cos(projectile.dir) * projectile.speed * delta
	let y = projectile.pos.y + Math.sin(projectile.dir) * projectile.speed * delta
	return { x: x, y: y }
}

function loop() {
	// For lag-testing
	if (LAGSWITCH) {
		setTimeout(loop, 500)
		LAGSWITCH = false
		return
	}

	requestAnimationFrame(loop)

	if (!currentTime) {
		currentTime = Date.now()
		return
	}
	let lastTime = currentTime
	currentTime = Date.now()

	let delta = currentTime - lastTime

	updatePos(delta)
	draw(delta)
}