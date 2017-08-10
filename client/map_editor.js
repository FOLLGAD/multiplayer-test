let canvas,
	ctx;

let scale = 50

let mapObject = {
	width: 2500,
	height: 2500,
	tiles: [],
	spawnpoints: [],
}

let viewport = {
	x: 0,
	y: 0,
	scroll: 100
}

var saveAs = saveAs || function (e) { "use strict"; if (typeof e === "undefined" || typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) { return } var t = e.document, n = function () { return e.URL || e.webkitURL || e }, r = t.createElementNS("http://www.w3.org/1999/xhtml", "a"), o = "download" in r, a = function (e) { var t = new MouseEvent("click"); e.dispatchEvent(t) }, i = /constructor/i.test(e.HTMLElement) || e.safari, f = /CriOS\/[\d]+/.test(navigator.userAgent), u = function (t) { (e.setImmediate || e.setTimeout)(function () { throw t }, 0) }, s = "application/octet-stream", d = 1e3 * 40, c = function (e) { var t = function () { if (typeof e === "string") { n().revokeObjectURL(e) } else { e.remove() } }; setTimeout(t, d) }, l = function (e, t, n) { t = [].concat(t); var r = t.length; while (r--) { var o = e["on" + t[r]]; if (typeof o === "function") { try { o.call(e, n || e) } catch (a) { u(a) } } } }, p = function (e) { if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(e.type)) { return new Blob([String.fromCharCode(65279), e], { type: e.type }) } return e }, v = function (t, u, d) { if (!d) { t = p(t) } var v = this, w = t.type, m = w === s, y, h = function () { l(v, "writestart progress write writeend".split(" ")) }, S = function () { if ((f || m && i) && e.FileReader) { var r = new FileReader; r.onloadend = function () { var t = f ? r.result : r.result.replace(/^data:[^;]*;/, "data:attachment/file;"); var n = e.open(t, "_blank"); if (!n) e.location.href = t; t = undefined; v.readyState = v.DONE; h() }; r.readAsDataURL(t); v.readyState = v.INIT; return } if (!y) { y = n().createObjectURL(t) } if (m) { e.location.href = y } else { var o = e.open(y, "_blank"); if (!o) { e.location.href = y } } v.readyState = v.DONE; h(); c(y) }; v.readyState = v.INIT; if (o) { y = n().createObjectURL(t); setTimeout(function () { r.href = y; r.download = u; a(r); h(); c(y); v.readyState = v.DONE }); return } S() }, w = v.prototype, m = function (e, t, n) { return new v(e, t || e.name || "download", n) }; if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) { return function (e, t, n) { t = t || e.name || "download"; if (!n) { e = p(e) } return navigator.msSaveOrOpenBlob(e, t) } } w.abort = function () { }; w.readyState = w.INIT = 0; w.WRITING = 1; w.DONE = 2; w.error = w.onwritestart = w.onprogress = w.onwrite = w.onabort = w.onerror = w.onwriteend = null; return m }(typeof self !== "undefined" && self || typeof window !== "undefined" && window || this.content); if (typeof module !== "undefined" && module.exports) { module.exports.saveAs = saveAs } else if (typeof define !== "undefined" && define !== null && define.amd !== null) { define("FileSaver.js", function () { return saveAs }) }

let gameObjects = [
	{
		type: "wall",
		name: "Wall"
	},
	{
		type: "player-spawnpoint",
		name: "Player Spawnpoint"
	}
]

let chosenGameObject = gameObjects[0]

document.addEventListener("DOMContentLoaded", () => {
	canvas = document.getElementsByTagName("canvas")[0]
	ctx = canvas.getContext("2d")

	let wi = document.getElementById("width-input")

	wi.value = mapObject.width

	wi.addEventListener("change", e => {
		mapObject.width = e.target.value
	})

	let hi = document.getElementById("height-input")

	hi.value = mapObject.height

	hi.addEventListener("change", e => {
		mapObject.height = e.target.value
	})

	let filename = document.getElementById("filename-input")

	document.getElementById("save-map-btn").addEventListener("click", () => {
		let blob = new Blob([JSON.stringify(mapObject)], { type: "text/plain;charset=utf-8" })
		saveAs(blob, filename.value + ".json")
	})

	canvas.width = viewport.width = window.innerWidth
	canvas.height = viewport.height = window.innerHeight - 100

	canvas.addEventListener("click", placeObject)

	let objectSelect = document.getElementById("object-select")

	for (let i = 0; i < gameObjects.length; i++) {
		let option = document.createElement("option")
		option.value = i
		option.textContent = gameObjects[i].name
		objectSelect.appendChild(option)
	}

	objectSelect.addEventListener("change", function (e) {
		chosenGameObject = gameObjects[Number(e.target.value)]
	})

	redraw()
})

document.addEventListener("keydown", e => {
	let scSkip = 10,
		mvSkip = 100;
	if (e.key == "+") {
		viewport.scroll = Math.min(viewport.scroll + scSkip, 500)
	} else if (e.key == "-") {
		viewport.scroll = Math.max(viewport.scroll - scSkip, 10)
	} else if (e.key == "ArrowRight") {
		viewport.x = Math.min(viewport.x + mvSkip, mapObject.width - viewport.width)
	} else if (e.key == "ArrowLeft") {
		viewport.x = Math.max(viewport.x - mvSkip, 0)
	} else if (e.key == "ArrowDown") {
		viewport.y = Math.min(viewport.y + mvSkip, mapObject.height - viewport.width)
	} else if (e.key == "ArrowUp") {
		viewport.y = Math.max(viewport.y - mvSkip, 0)
	} else {
		return
	}

	redraw()
})

function placeObject(e) {
	let ds = viewport.scroll / 100

	let x = (e.clientX / ds) + viewport.x,
		y = (e.clientY / ds) + viewport.y;

	let obj = {
		x: Math.floor(x - (x % scale)),
		y: Math.floor(y - (y % scale)),
		type: chosenGameObject.type,
		scale: scale
	}

	if (obj.type == "wall") {
		let index = mapObject.tiles.findIndex(tile => tile.x == obj.x && tile.y == obj.y && tile.type == obj.type)

		if (obj.x >= mapObject.width || obj.y >= mapObject.height || obj.x + obj.scale < 0 || obj.y + obj.scale < 0) return

		if (index === -1) {
			mapObject.tiles.push(obj)
		} else {
			let sp = mapObject.tiles.splice(index, 1)
		}
	} else if (obj.type == "player-spawnpoint") {
		let index = mapObject.spawnpoints.findIndex(tile => tile.x == obj.x && tile.y == obj.y && tile.type == obj.type)

		if (obj.x >= mapObject.width || obj.y >= mapObject.height || obj.x + obj.scale < 0 || obj.y + obj.scale < 0) return

		if (index === -1) {
			mapObject.spawnpoints.push(obj)
		} else {
			let sp = mapObject.spawnpoints.splice(index, 1)
		}
	}

	redraw()
}

function redraw() {
	let ds = viewport.scroll / 100

	ctx.clearRect(0, 0, canvas.width, canvas.height)

	ctx.scale(ds, ds)
	ctx.translate(-viewport.x, -viewport.y)

	ctx.fillStyle = "#fff"
	ctx.fillRect(0, 0, mapObject.width, mapObject.height)

	mapObject.tiles.forEach(tile => {
		ctx.fillStyle = "#555"
		ctx.fillRect(tile.x, tile.y, tile.scale, tile.scale)
	})
	mapObject.spawnpoints.forEach(tile => {
		ctx.fillStyle = "#efefb6"
		ctx.beginPath()
		ctx.arc(tile.x + tile.scale / 2, tile.y + tile.scale / 2, tile.scale / 2, 0, Math.PI * 2, false)
		ctx.fill()
	})

	ctx.translate(viewport.x, viewport.y)
	ctx.scale(1 / ds, 1 / ds)
}