let socket = new WebSocket("ws://localhost:8080"),
	playerid,
	myplayer,
	gamestate;

let canvas = document.createElement("canvas");
let ctx = canvas.getContext("2d");

document.addEventListener("DOMContentLoaded", function () {
	document.body.appendChild(canvas);
});

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function addVectors(base, add) {
	let x = base.x + add.x;
	let y = base.y + add.y;
	return { x, y };
}

function sendUpdate() {
	if (keys["KeyW"]) {
		myplayer.vel.y = -myplayer.speed;
	} else if (keys["KeyS"]) {
		myplayer.vel.y = myplayer.speed;
	} else {
		myplayer.vel.y = 0;
	}
	if (keys["KeyA"]) {
		myplayer.vel.x = -myplayer.speed;
	} else if (keys["KeyD"]) {
		myplayer.vel.x = myplayer.speed;
	} else {
		myplayer.vel.x = 0;
	}
	gamestate.players.forEach(player => {
		player.pos = addVectors(player.pos, player.vel);
	})
	socket.send(JSON.stringify({ type: "playerupdate", data: myplayer }));
	setTimeout(sendUpdate, 15);
}

function getPlayer() {
	for (let i = 0; i < gamestate.players.length; i++) {
		if (gamestate.players[i].id == playerid) {
			return gamestate.players[i];
		}
	}
}

socket.onopen = function () {
	console.log("connected to server");
}

socket.onmessage = function (message) {
	let data = JSON.parse(message.data);
	switch (data.type) {
		case "id":
			playerid = data.data;
			break;
		case "initgame":
			gamestate = data.data;
			myplayer = getPlayer();
			sendUpdate();
			draw();
			break;
		case "gamestate":
			gamestate = data.data;
			let oldmyplayer = myplayer;
			myplayer = getPlayer();
			myplayer.pos = oldmyplayer.pos;
			myplayer.vel = oldmyplayer.vel;
			break;
	}
}

const keys = {};

document.addEventListener("keydown", function (e) {
	keys[e.code] = true;
})
document.addEventListener("keyup", function (e) {
	keys[e.code] = false;
})

function draw() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	gamestate.players.forEach(player => {
		ctx.fillStyle = player.color;
		ctx.fillRect(player.pos.x, player.pos.y, 20, 20);
	});
	requestAnimationFrame(draw);
}