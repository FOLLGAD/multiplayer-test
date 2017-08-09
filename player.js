let vector = require("./vector"),
	shortid = require("shortid");
let random = Math.random;

class player {
	constructor({ client }) {
		this.client = client

		this.id = shortid.generate()
		this.color = `rgb(${random() * 255 | 0}, ${random() * 255 | 0}, ${random() * 255 | 0})`
		this.size = 40

		this.pos = new vector(null, null)
		this.lastPos = new vector(null, null)
		this.rotation = 0
		this.dead = true

		this.speed = 0.5
		this.health = 100
		this.isn = 0
	}
	spawn() {
		this.pos.set(500, 500)
		this.health = 100
		this.dead = false
	}
	harm(damage) {
		this.health -= damage
		if (this.health <= 0) {
			this.health = 0
			this.client.send(JSON.stringify({ type: "die" }))
			this.pos.x = null
			this.pos.y = null
			this.dead = true
		}
	}
	toObject() {
		return {
			id: this.id,
			pos: this.pos.toObject(),
			lastPos: this.lastPos.toObject(),
			color: this.color,
			speed: this.speed,
			size: this.size,
			dead: this.dead,
			rotation: this.rotation,
			health: this.health,
			isn: this.isn,
		}
	}
	toBare() {
		return {
			id: this.id,
			pos: this.pos.toObject(),
			isn: this.isn,
			health: this.health,
		}
	}
}

module.exports = player;