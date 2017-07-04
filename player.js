let vector = require("./vector");

class player {
	constructor({ pos = new vector(0, 0), id }) {
		console.assert(id);
		this.pos = pos;
		this.vel = new vector(0, 0);
		this.id = id;

		this.speed = 2;
	}
}

module.exports = player;