let socket = new WebSocket("ws://192.168.1.20:8080"),
	player,
	dead = false,
	gamestate = {
		players: [],
		bullets: [],
	},
	canvas = document.createElement("canvas"),
	ctx = canvas.getContext("2d"),
	currentTime = null;

let overlay, menu, spawn;

let LAGSWITCH = false

let showMenu

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

function updatePos() {
	if (player) {
		if (!currentTime) {
			currentTime = Date.now()
			return
		}
		let lastTime = currentTime
		currentTime = Date.now()

		let delta = currentTime - lastTime

		movePlayer(player, keys, delta)

		let dir = Math.atan2(mouse.y - player.pos.y, mouse.x - player.pos.x)

		socket.send(JSON.stringify({ type: "playerupdate", keys: keys, dir: Math.atan2(mouse.y - player.pos.y, mouse.x - player.pos.x), time: currentTime }))
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
			loop()
			break
		case "gamestate":
			gamestate.players = data.players
			gamestate.bullets = data.bullets
			break
		case "playerpos":
			player.pos.x = data.pos.x
			player.pos.y = data.pos.y
			currentTime = data.time
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
document.addEventListener("DOMContentLoaded", function () {
	document.body.addEventListener("mouseleave", function (e) {
		mouse.x = undefined
		mouse.y = undefined
	})
})
document.addEventListener("contextmenu", function (e) {
	e.preventDefault()
})
document.addEventListener("mousedown", function (e) {
	let time = Date.now()
	socket.send(JSON.stringify({
		type: "shoot",
		target: mouse,
		pos: player.pos,
		time: time,
	}))
})
// document.addEventListener("mouseup", function (e) {
// 	keys.shooting = false
// })

function draw() {
	ctx.clearRect(0, 0, canvas.width, canvas.height)

	gamestate.players.forEach(player => {
		ctx.fillStyle = player.color
		ctx.fillRect(player.pos.x, player.pos.y, player.size, player.size)
	})

	ctx.fillStyle = player.color
	ctx.fillRect(player.pos.x, player.pos.y, player.size, player.size)

	// Draw cursor
	// if (mouse.x != void 0 && mouse.y != void 0) {
	// 	ctx.fillStyle = "rgb(80, 80, 80)"
	// 	let w = 10
	// 	ctx.fillRect(mouse.x - w / 2, mouse.y - w / 2, w, w)
	// }

	for (let i = 0; i < gamestate.bullets.length; i++) {
		let bullet = gamestate.bullets[i];
		ctx.fillStyle = "rgb(12, 12, 0)"
		ctx.fillRect(bullet.pos.x, bullet.pos.y, bullet.size, bullet.size)
	}
}

function loop() {
	if (LAGSWITCH) {
		LAGSWITCH = false
		setTimeout(loop, 500)
		return
	}
	requestAnimationFrame(loop)
	updatePos()
	draw()
}