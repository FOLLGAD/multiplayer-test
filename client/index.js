let dev = true
let ip = dev ? "localhost" : window.location.hostname

let serverId

window.location.search.slice(1).split("&").forEach(s => {
	let d = s.split("=")
	if (d[0] == "game") serverId = d[1]
})

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
	currentTime = null,
	viewport = {
		x: 0,
		y: 0,
		width: null,
		height: null
	},
	screen = "main_menu";

let canvas = document.createElement("canvas"),
	ctx = canvas.getContext("2d");

/**
 * 
 * @param {string} scr "main_menu" | "game_menu" | "server_list" | "game_canvas"
 */
function showScreen(scr) {
	if (scr == "game_canvas") {
		game_hud.style.display = "block"
		game_menu.style.display = "none"
		main_menu.style.display = "none"
		server_menu.style.display = "none"
	} else if (scr == "game_menu") {
		game_menu.style.display = "block"
		main_menu.style.display = "none"
		game_hud.style.display = "none"
		server_menu.style.display = "none"
		document.getElementById("player_name").focus()
	} else if (scr == "server_list") {
		server_menu.style.display = "block"
		game_hud.style.display = "none"
		game_menu.style.display = "none"
		main_menu.style.display = "none"
	} else if (scr == "main_menu") {
		main_menu.style.display = "block"
		game_hud.style.display = "none"
		game_menu.style.display = "none"
		server_menu.style.display = "none"
	}
	screen = scr
}

function emit(type, data) {
	let info = { type: type }
	if (data) info.data = data
	socket.send(JSON.stringify(info))
}

function resize() {
	canvas.width = window.innerWidth
	canvas.height = window.innerHeight

	viewport.width = canvas.width
	viewport.height = canvas.height
}

let game_menu,
	main_menu,
	game_hud,
	connect_btn,
	spawn_btn,
	chat_input,
	chat,
	server_list,
	server_menu,
	create_new;

document.addEventListener("DOMContentLoaded", function () {
	document.body.appendChild(canvas)

	window.addEventListener("resize", resize)
	resize()

	game_menu = document.getElementById("game_menu")
	main_menu = document.getElementById("main_menu")
	game_hud = document.getElementById("game_hud")
	connect_btn = document.getElementById("connect_btn")
	spawn_btn = document.getElementById("spawn_btn")
	chat_input = document.getElementById("chat_input")
	chat = document.getElementById("chat_messages")
	server_list = document.getElementById("servers")
	server_menu = document.getElementById("server_menu")
	create_new = document.getElementById("create_new")

	connect_btn.addEventListener("click", connect)

	spawn_btn.addEventListener("click", spawn)

	chat.addEventListener("mouseenter", e => {
		chat.style.overflowY = "scroll"
	})
	chat.addEventListener("mouseleave", e => {
		chat.style.overflowY = "hidden"
	})

	create_new.addEventListener("click", () => joinServer())

	server_list.addEventListener("click", function (e) {
		let d = e.target.tagName
		if (d == "TD") {
			let id = e.target.parentElement.children[0].textContent
			joinServer(id)
		}
	})
});

function joinServer(id) {
	emit("join-game", id)
}

function spawn() {
	emit("spawn")
	emit("change-name", document.getElementById("player_name").value)
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

		let rotation = getPlayerRotation()

		player.rotation = rotation

		let input = {
			delta: delta,
			vdt: 0,
			hdt: 0,
			rotation: rotation,
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

		sendInput(input)
	}
}

function getPlayerRotation() {
	return Math.atan2(mouse.y + viewport.y - player.pos.y - player.size / 2,
		mouse.x + viewport.x - player.pos.x - player.size / 2)
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

	player.pos.x = Math.floor(player.pos.x)
	player.pos.y = Math.floor(player.pos.y)

	player.isn = input.isn
}

function checkCollision(player, way) {
	let map = gamestate.map

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

function getMouseCoords() {
	return {
		x: mouse.x + viewport.x,
		y: mouse.y + viewport.y
	}
}

function shootBullet() {
	if (dead || player.pos.x == null || player.pos.y == null ||
		mouse.x == null || mouse.y == null) {
		return
	}

	let target = getMouseCoords()

	let time = Date.now()
	emit("shoot", {
		pos: player.pos,
		target: target,
		time: time,
	})

	let bulletsize = 8

	let midpos = {
		x: player.pos.x + player.size / 2,
		y: player.pos.y + player.size / 2
	}

	let bullet = {
		pos: midpos,
		dir: getPlayerRotation(),
		// damage: weapons[player.weapon].damage,
		damage: 50,
		speed: 1.5,
		radius: bulletsize,
		owner: player.id,
	}
	gamestate.mybullets.push(bullet)
}

function fetchServers() {
	emit("fetch-servers")
}

function onopen() {
	showScreen("server_list")
	fetchServers()
}

function onServerJoin() {
	initialize()
}

function getPlayerById(id) {
	for (let i = 0; i < gamestate.players.length; i++) {
		if (gamestate.players[i].id == id) {
			return gamestate.players[i]
		}
	}
}

function addChatMessage(data) {
	let newmsg = document.createElement("li")
	let player = getPlayerById(data[0])
	let name = player ? player.name : "unnamed player"
	newmsg.textContent = `[${name}] ${data[1]}`

	let chat = document.getElementById("chat_messages")

	let isAtBottom = chat.scrollTop + chat.clientHeight == chat.scrollHeight
	chat.appendChild(newmsg)
	if (isAtBottom) chat.scrollTo(0, chat.scrollHeight)
}

function onmessage(message) {
	console.log("messsage", message)
	let parsed = JSON.parse(message.data),
		type = parsed.type,
		data = parsed.data;

	switch (type) {
		case "server-list":
			let table_body = server_menu.querySelector("tbody")
			Array.from(table_body.children).forEach(function (c) {
				table_body.removeChild(c)
			})
			if (data.length === 0) {
				// Dam
			} else {
				data.forEach(server => {
					let row = document.createElement("tr")

					let name = document.createElement("td"),
						players = document.createElement("td")

					name.textContent = server[0]
					players.textContent = server[1]

					row.appendChild(name)
					row.appendChild(players)

					table_body.appendChild(row)
				})
			}
			break
		case "game-setup":
			showScreen("game_menu")
			gamestate.map = data.map
			gamestate.players = data.players

			player = data.players
				.find(player => player.id == data.id)
			loop()
			break
		case "gamestate":
			data.players
				.forEach(pl => {
					for (let i = 0; i < gamestate.players.length; i++) {
						let realpl = gamestate.players[i]
						if (pl.id == realpl.id) {
							if (pl.name != void 0) {
								realpl.name = pl.name
							}
							if (pl.pos != void 0) {
								realpl.pos = pl.pos
							}
							if (pl.rotation != void 0) {
								realpl.rotation = pl.rotation
							}
							if (pl.health != void 0) {
								realpl.health = pl.health
							}
							if (pl.isn != void 0) {
								realpl.isn = pl.isn
							}
							if (pl.dead != void 0) {
								realpl.dead = pl.dead
							}
						}
					}
				})
			gamestate.bullets = data.bullets

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
		case "chat":
			addChatMessage(data)
			break
		case "add-player":
			gamestate.players.push(data)
			break
		case "remove-player":
			let index = gamestate.players.findIndex(player => data == player.id)
			index !== -1 && gamestate.players.splice(index, 1)
	}
}

function connect() {
	socket = new WebSocket(`${dev ? "ws": "wss"}://${ip}:${dev ? "80" : "443"}/websocket`)
	socket.onopen = onopen
	socket.onmessage = onmessage
	socket.onclose = onclose
}

function onclose() {
	showScreen("main_menu")
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
}

let keyBinds = {
	"KeyW": "up",
	"KeyS": "down",
	"KeyD": "right",
	"KeyA": "left",
}

function sendChatMsg() {
	let chat = document.getElementById("chat_input")
	emit("chat-msg", chat.value)
	chat.value = ""
}

// For lag testing

let LAGSWITCH = false

document.addEventListener("keydown", function (e) {
	if (e.repeat) {
		return
	}
	if (screen == "game_canvas") {
		if (e.code == "Backquote") {
			LAGSWITCH = true
		} else if (document.activeElement == chat_input) {
			if (e.key == "Enter") {
				sendChatMsg()
				chat_input.blur()
			}
		} else if (e.key == "Enter") {
			chat_input.focus()
		} else {
			let bind = keyBinds[e.code]
			bind && (keys[bind] = true)
		}
	} else {
		if (e.key == "Enter") {
			if (screen == "main_menu") connect()
			else if (screen == "game_menu") spawn()
		}
	}
})
document.addEventListener("keyup", function (e) {
	if (e.repeat) {
		return
	} else {
		let bind = keyBinds[e.code]
		bind && (keys[bind] = false)
	}
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
	ctx.clearRect(0, 0, viewport.width, viewport.height)
	ctx.translate(-viewport.x, -viewport.y)

	let packetDelta = 0

	gamestate.players.forEach(drawPlayer => {
		let newpos = drawPlayer.pos

		gamestate.map.tiles.forEach(tile => {
			ctx.fillStyle = "#777"
			ctx.fillRect(tile.x, tile.y, tile.scale, tile.scale)
		})

		if (drawPlayer.dead) {

		} else if (drawPlayer.id != player.id) {

			ctx.translate(newpos.x + drawPlayer.size / 2,
				newpos.y + drawPlayer.size / 2)
			ctx.rotate(drawPlayer.rotation)
			ctx.fillStyle = drawPlayer.color
			ctx.fillRect(-drawPlayer.size / 2, -drawPlayer.size / 2,
				drawPlayer.size, drawPlayer.size)
			ctx.rotate(-drawPlayer.rotation)
			ctx.translate(-newpos.x - drawPlayer.size / 2,
				-newpos.y - drawPlayer.size / 2)

			ctx.textAlign = "center"
			ctx.font = "24px Arial"
			ctx.fillStyle = "#333"
			ctx.fillText(drawPlayer.name,
				drawPlayer.pos.x + drawPlayer.size / 2, drawPlayer.pos.y - 10)
		} else {
			ctx.translate(player.pos.x + player.size / 2, player.pos.y + player.size / 2)
			ctx.rotate(player.rotation)
			ctx.fillStyle = player.color
			ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size)
			ctx.rotate(-player.rotation)
			ctx.translate(-player.pos.x - player.size / 2, -player.pos.y - player.size / 2)

			// Health bar
			let percentage = player.health / 100
			ctx.fillStyle = "rgb(80, 240, 20)"
			ctx.fillRect(player.pos.x + player.size / 2 - ((player.size / 2) * percentage),
				player.pos.y - 10, player.size * percentage, 10)
		}
	})

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

		if (checkBulletCollision(bullet, gamestate.mybullets, i)) {
			i--
		} else {
			drawBullet(newpos, bullet)
		}
	}

	ctx.translate(viewport.x, viewport.y)
}

function checkBulletCollision(bullet, array, index) {
	let map = gamestate.map

	for (let i = 0; i < map.tiles.length; i++) {
		let tile = map.tiles[i]

		let colx = bullet.pos.x + bullet.radius > tile.x
			&& bullet.pos.x - bullet.radius < tile.x + tile.scale,
			coly = bullet.pos.y + bullet.radius > tile.y
				&& bullet.pos.y - bullet.radius < tile.y + tile.scale;

		if ((bullet.pos.x < 0 || bullet.pos.x > map.width ||
			bullet.pos.y < 0 || bullet.pos.y > map.height) ||
			colx && coly) {
			array.splice(index, 1)
			return true
		}
	}
	return false
}

function drawBullet(visbullet, bullet) {
	ctx.fillStyle = "rgb(12, 12, 0)"

	ctx.beginPath()
	ctx.arc(visbullet.x, visbullet.y, bullet.radius, 0, Math.PI * 2, false)
	ctx.fill()
}

function moveProjectile(projectile, delta) {
	let x = projectile.pos.x + Math.cos(projectile.dir) * projectile.speed * delta
	let y = projectile.pos.y + Math.sin(projectile.dir) * projectile.speed * delta
	return { x: x, y: y }
}

function calculateViewport() {
	if (player.dead) return

	viewport.x = Math.floor(player.pos.x - viewport.width / 2)
	if (viewport.x < 0)
		viewport.x = 0
	else if (viewport.x + viewport.width > gamestate.map.width)
		viewport.x = gamestate.map.width - viewport.width

	viewport.y = Math.floor(player.pos.y - viewport.height / 2)
	if (viewport.y < 0)
		viewport.y = 0
	else if (viewport.y + viewport.height > gamestate.map.height)
		viewport.y = gamestate.map.height - viewport.height

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

	calculateViewport()

	draw(delta)
}