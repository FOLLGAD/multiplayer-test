let vector = require("./vector"),
	shortid = require("shortid");

let random = Math.random;

module.exports = class player {
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

		this.classname = "warrior"

		this.name = "Guest " + ((Math.random() * 100 + 1) | 0)
	}
	changeClass(classname) {
		if (classes.indexOf(classname) !== -1) {
			this.class = classname
			return true
		}
		return false
	}
	spawn(x = 0, y = 0) {
		let theclass = classes[this.classname]
		this.pos.set(x, y)
		this.health = theclass.basehp
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
			name: this.name,
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
			name: this.name,
			isn: this.isn,
			health: this.health,
			rotation: this.rotation,
			dead: this.dead,
		}
	}
}

let classes = {
	warrior: {
		basehp: 150,
	},
	archer: {
		basehp: 100,
	},
	mage: {
		basehp: 75,
	},
}