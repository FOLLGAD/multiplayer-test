let maps = {
	1: {
		width: 100,
		height: 100
	},
	2: {
		width: 200,
		height: 300
	}
}

class game {
	constructor({ players, id, map = maps[1] }) {
		this.players = players;
		this.map = map;
		this.id = id;
	}
	start() {
		setTimeout(this.update.bind(this), 15);
	}
	update() {
		this.players.forEach(pl => {
			pl.pos.add(pl.vel);
		})
	}
}

module.exports = game;