let socket = new WebSocket("ws://192.168.1.20:8080"),
	player,
	dead = true,
	gamestate = {
		players: [],
		bullets: [],
		lastPacket: null,
		mybullets: [],
	},
	canvas = document.createElement("canvas"),
	ctx = canvas.getContext("2d"),
	currentTime = null;

let overlay, menu, spawn, showMenu

document.addEventListener("DOMContentLoaded", function () {
	document.body.appendChild(canvas)

	overlay = document.body.appendChild(document.createElement("div"));
	menu = overlay.appendChild(document.createElement("div"));
	spawn = menu.appendChild(document.createElement("button"));
	spawn.textContent = "Spawn"

	overlay.style.position = "fixed"
	overlay.style.top = 0

	showMenu = function () {
		menu.style.display = "block"
	}

	spawn.addEventListener("click", function () {
		socket.send(JSON.stringify({ type: "spawn" }))
		menu.style.display = "none"
	})
});

canvas.width = window.innerWidth
canvas.height = window.innerHeight

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
		movePlayer(player, keys, delta)

		player.rotation = Math.atan2(mouse.y - player.pos.y - player.size / 2, mouse.x - player.pos.x - player.size / 2)

		socket.send(JSON.stringify({ type: "playerupdate", keys: keys, target: { x: mouse.x, y: mouse.y }, time: currentTime }))
	}
}

function movePlayer(player, keys, delta) {
	let scalar = (keys.right || keys.left) && (keys.up || keys.down) ? 0.7 : 1
	if (keys.right !== keys.left) {
		if (keys.right) {
			player.pos.x += player.speed * delta * scalar
		} else {
			player.pos.x -= player.speed * delta * scalar
		}
	}
	if (keys.down !== keys.up) {
		if (keys.down) {
			player.pos.y += player.speed * delta * scalar
		} else {
			player.pos.y -= player.speed * delta * scalar
		}
	}
}

function shootBullet() {

	if (dead || player.pos.x == null || player.pos.y == null || mouse.x == null || mouse.y == null) {
		return
	}

	let time = Date.now()
	socket.send(JSON.stringify({
		type: "shoot",
		pos: player.pos,
		target: mouse,
		time: time,
	}))

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

socket.onopen = function () {
	console.log("Connection established");
}

socket.onmessage = function (message) {
	let data = JSON.parse(message.data)
	switch (data.type) {
		case "initgame":
		case "gameinfo":
			gamestate.players = data.players
			player = data.player
			break
		case "gamestate":
			gamestate.players = data.players
			gamestate.bullets = data.bullets
			player.health = data.player.health
			gamestate.lastPacket = data.time
			break
		case "playerpos":
			player.pos.x = data.pos.x
			player.pos.y = data.pos.y
			currentTime = data.time
			dead = false
			break
		case "die":
			player.pos.x = undefined
			player.pos.y = undefined
			dead = true
			showMenu()
			break
		case "log":
			console.log(data.msg)
			break
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
	keys[keyBinds[e.code]] = true
})
document.addEventListener("keyup", function (e) {
	keys[keyBinds[e.code]] = false
})

let mouse = { x: undefined, y: undefined }

document.addEventListener("mousemove", function (e) {
	mouse.x = e.clientX
	mouse.y = e.clientY
})
document.addEventListener("contextmenu", function (e) {
	e.preventDefault()
})
document.addEventListener("mousedown", shootBullet)
// document.addEventListener("mouseup", function (e) {
// 	keys.shooting = false
// })

let clientsmoothing = true

function draw(delta) {
	ctx.clearRect(0, 0, canvas.width, canvas.height)

	// For visual interpolation
	let packetDelta = currentTime - gamestate.lastPacket

	if (packetDelta > 200) {
		packetDelta = 200
	}

	gamestate.players.forEach(player => {
		let newpos

		if (clientsmoothing && packetDelta) {
			newpos = addVectors(player.pos, multiplyVector(player.vel, packetDelta * player.speed))
		} else {
			newpos = player.pos
		}

		ctx.translate(newpos.x + player.size / 2, newpos.y + player.size / 2)
		ctx.rotate(player.rotation)
		ctx.fillStyle = player.color
		ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size)
		ctx.rotate(-player.rotation)
		ctx.translate(-newpos.x - player.size / 2, -newpos.y - player.size / 2)
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

loop()