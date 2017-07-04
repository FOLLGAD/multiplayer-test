let vector = require("./vector");

class player {
	constructor({ pos = new vector(0, 0), id }) {
		console.assert(id);
		this.pos = pos;
		this.vel = new vector(0, 0);
		this.id = id;

		let rn = Math.random;
		this.color = `rgb(${rn() * 255 | 0}, ${rn() * 255 | 0}, ${rn() * 255 | 0})`;
		this.speed = 2;
	}
}

module.exports = player;