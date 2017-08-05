let vector = require("./vector"),
	shortid = require("shortid")
let random = Math.random;

class player {
	constructor({ client }) {
		console.assert(client);
		this.id = shortid.generate()
		this.pos = new vector(null, null);
		this.vel = new vector(0, 0);
		this.client = client;

		this.color = `rgb(${random() * 255 | 0}, ${random() * 255 | 0}, ${random() * 255 | 0})`;
		this.speed = 0.5;
		this.cooldown = 0;
		this.size = 40;
		this.dead = true;
	}
	spawn() {
		this.pos.set(0, 0)
		this.dead = false
	}
	die() {
		this.dead = true
		this.pos.x = null
		this.pos.y = null
	}
	toObject() {
		return {
			pos: this.pos.toObject(),
			vel: this.vel.toObject(),
			color: this.color,
			speed: this.speed,
			size: this.size,
			dead: this.dead,
		}
	}
}

module.exports = player;