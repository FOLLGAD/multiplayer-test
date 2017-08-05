class vector {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}
	set(x, y) {
		this.x = x;
		this.y = y;
	}
	add(vector) {
		this.x += vector.x;
		this.y += vector.y;
		return this;
	}
	hypot(vector) {
		return Math.hypot(this.x - vector.x, this.y - vector.y)
	}
	toObject() {
		return { x: this.x, y: this.y };
	}
}

module.exports = vector;