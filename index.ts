import { assert } from "./lib"

interface CursorEvent {
	altKey: boolean
	button: number
	ctrlKey: boolean
	movementX: number
	movementY: number
	shiftKey: boolean
	x: number
	y: number
	timeStamp: number
}

type CursorEventHandler = (event: CursorEvent) => any

export enum CursorEventType {
	Down,
	Up,
	Enter,
	Move,
	Leave
	/* TODO Over
		when cursor skips over sprite, line from old location to new
		passes through sprite
	*/
}

export class Texture extends Image {
	constructor(src: string, options?: Partial<{
		width: number
		height: number
	}>) {
		const { width, height } = options || {}

		super(width, height)

		this.src = src
	}
}

export const missingTexture = new Texture("data:image/png;base64,iVBORw0KGgoAAA\
ANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAI0lEQVQ4jWP4z/D/Pz7MwMCAH48aMCwMIKSACAtGDRj6B\
gAAMbX+EPmqY6kAAAAASUVORK5CYII=")

export class Engine {
	context: CanvasRenderingContext2D
	sprites: Sprite[] = []
	scale = 1

	constructor(public canvas = document.createElement("canvas")) {
		const context = canvas.getContext("2d")

		assert(context)

		this.context = context

		canvas.addEventListener("mouseenter", ({
			pageX,
			pageY,
			timeStamp,
			altKey,
			buttons: button,
			ctrlKey,
			movementX,
			movementY,
			shiftKey
		}) => {
			const x = (pageX - canvas.offsetLeft) / this.scale
			const y = (pageY - canvas.offsetTop) / this.scale

			for (const sprite of this.sprites) {
				if (sprite.overlapsPoint(x, y))
					for (const handler of sprite.eventHandlers[CursorEventType.Enter])
						handler({
							x: x - sprite.x,
							y: y - sprite.y,
							button, altKey, timeStamp, ctrlKey,
							movementX, movementY, shiftKey
						})
			}
		})

		canvas.addEventListener("mousemove", ({
			pageX,
			pageY,
			timeStamp,
			altKey,
			buttons: button,
			ctrlKey,
			movementX,
			movementY,
			shiftKey
		}) => {
			movementX = movementX / this.scale
			movementY = movementY / this.scale

			const x = (pageX - canvas.offsetLeft) / this.scale
			const y = (pageY - canvas.offsetTop) / this.scale
			const oldX = x - movementX
			const oldY = y - movementY
			const cursorLeaveHandlers: Sprite[] = []
			const cursorMoveHandlers: Sprite[] = []
			const cursorEnterHandlers: Sprite[] = []

			for (const sprite of this.sprites) {
				const overlapsOldCursorPosition = sprite.overlapsPoint(oldX, oldY)
				const overlapsNewCursorPosition = sprite.overlapsPoint(x, y)

				if (overlapsOldCursorPosition && overlapsNewCursorPosition)
					cursorMoveHandlers.push(sprite)
				else if (overlapsOldCursorPosition)
					cursorLeaveHandlers.push(sprite)
				else if (overlapsNewCursorPosition)
					cursorEnterHandlers.push(sprite)
			}

			for (const sprite of cursorLeaveHandlers)
				callHandlers(sprite, CursorEventType.Leave)

			for (const sprite of cursorMoveHandlers)
				callHandlers(sprite, CursorEventType.Move)

			for (const sprite of cursorEnterHandlers)
				callHandlers(sprite, CursorEventType.Enter)

			function callHandlers(sprite: Sprite, eventType: CursorEventType) {
				for (const handler of sprite.eventHandlers[eventType])
					handler({
						x: x - sprite.x,
						y: y - sprite.y,
						button, altKey, timeStamp, ctrlKey,
						movementX, movementY, shiftKey
					})
			}
		})

		canvas.addEventListener("mouseleave", ({
			pageX,
			pageY,
			timeStamp,
			altKey,
			buttons: button,
			ctrlKey,
			movementX,
			movementY,
			shiftKey
		}) => {
			const x = (pageX - canvas.offsetLeft) / this.scale
			const y = (pageY - canvas.offsetTop) / this.scale

			for (const sprite of this.sprites)
				if (sprite.overlapsPoint(x, y))
					for (const handler of sprite.eventHandlers[CursorEventType.Enter])
						handler({
							x: x - sprite.x,
							y: y - sprite.y,
							button, altKey, timeStamp, ctrlKey,
							movementX, movementY, shiftKey
						})
		})

		canvas.addEventListener("mousedown", ({
			pageX,
			pageY,
			timeStamp,
			altKey,
			buttons: button,
			ctrlKey,
			movementX,
			movementY,
			shiftKey
		}: MouseEvent) => {
			const x = (pageX - canvas.offsetLeft) / this.scale
			const y = (pageY - canvas.offsetTop) / this.scale

			for (const sprite of this.sprites)
				if (sprite.overlapsPoint(x, y))
					for (const handler of sprite.eventHandlers[CursorEventType.Down])
						handler({
							x: x - sprite.x,
							y: y - sprite.y,
							movementX: movementX / this.scale,
							movementY: movementY / this.scale,
							altKey, timeStamp, button, ctrlKey, shiftKey
						})
		})

		canvas.addEventListener("mouseup", ({
			pageX,
			pageY,
			timeStamp,
			altKey,
			buttons: button,
			ctrlKey,
			movementX,
			movementY,
			shiftKey
		}: MouseEvent) => {
			const x = (pageX - canvas.offsetLeft) / this.scale
			const y = (pageY - canvas.offsetTop) / this.scale

			for (const sprite of this.sprites)
				if (sprite.overlapsPoint(x, y))
					for (const handler of sprite.eventHandlers[CursorEventType.Up])
						handler({
							x: x - sprite.x,
							y: y - sprite.y,
							movementX: movementX / this.scale,
							movementY: movementY / this.scale,
							altKey, timeStamp, button, ctrlKey, shiftKey
						})
		})

		requestAnimationFrame(this.main)
	}

	newSprite({
		x, y, layer, hidden, texture, scripts, width, index, processes, height
	}: Partial<Sprite> = {}) {
		return new Sprite(this, {
			x, y, layer, hidden, texture, scripts, width, index, processes, height
		})
	}

	newBitmapFont(chars: string, texture: Texture, {
		spaceWidth,
		horizontalMargin = 1,
		verticalMargin = 1
	}: Partial<BitmapFont>) {
		return new BitmapFont(this, chars, texture, {
			spaceWidth, horizontalMargin, verticalMargin
		})
	}

	autoResize() {
		this.onResize()

		addEventListener("resize", this.onResize)
	}

	onResize() {
		this.scale = Math.min(
			innerHeight / this.canvas.height,
			innerWidth / this.canvas.width
		)

		if (this.scale > 1) {
			if (innerHeight < innerWidth)
				this.scale = Math.floor(this.scale)

			this.canvas.style.imageRendering = "crisp-edges"
			this.canvas.style.imageRendering = "pixelated"
		} else
			this.canvas.style.imageRendering = ""

		this.canvas.style.height = `${this.canvas.height * this.scale}px`
		this.canvas.style.width = `${this.canvas.width * this.scale}px`
	}

	main() {
		requestAnimationFrame(this.main)

		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
		this.sprites.sort((a, b) => a.layer - b.layer)

		for (const sprite of this.sprites) {
			sprite.scripts.length && sprite.scripts[0].next().done &&
				sprite.scripts.shift()

			const postprocFinished: number[] = []

			for (let i = 0; i < sprite.processes.length; i++)
				sprite.processes[i].next().done &&
					postprocFinished.push(i)

			for (const animationDone of postprocFinished.reverse())
				sprite.processes.splice(animationDone, 1)

			if (!sprite.hidden) {
				const width = sprite.width || sprite.height
				const height = sprite.height || sprite.width

				if (width && height)
					this.context.drawImage(
						sprite.texture,
						Math.floor(
							sprite.index % (sprite.texture.width / width)
						) * width,
						Math.floor(
							sprite.index / (sprite.texture.width / width)
						) * height,
						width,
						height,
						sprite.x,
						sprite.y,
						width,
						height
					)
				else
					this.context.drawImage(sprite.texture, sprite.x, sprite.y)
			}
		}
	}
}

class Sprite {
	x: number
	y: number
	layer: number
	hidden: boolean
	texture: Texture
	scripts: Generator[]
	width?: number
	height?: number
	index: number
	processes: Generator[]

	eventHandlers: Record<CursorEventType, CursorEventHandler[]> = {
		[CursorEventType.Down]: [],
		[CursorEventType.Up]: [],
		[CursorEventType.Enter]: [],
		[CursorEventType.Move]: [],
		[CursorEventType.Leave]: []
	}

	constructor(public engine: Engine, {
		x = 0,
		y = 0,
		layer = 0,
		hidden = false,
		texture = missingTexture,
		scripts = [],
		width,
		index = 0,
		processes = [],
		height
	}: Partial<Sprite> = {}) {
		this.x = x
		this.y = y
		this.layer = layer
		this.hidden = hidden
		this.texture = texture
		this.scripts = scripts
		this.width = width
		this.index = index
		this.processes = processes
		this.height = height

		engine.sprites.push(this)
	}

	on(type: CursorEventType, handler: CursorEventHandler) {
		this.eventHandlers[type].push(handler)

		return this
	}

	overlapsPoint(x: number, y: number) {
		return x > this.x
			&& x < this.x + this.texture.width
			&& y > this.y
			&& y < this.y + this.texture.height
	}

	overlapsSprite({ x, y, texture }: Sprite) {
		// const maxAx = this.x + this.texture.width
		// const minBx = x
		// const minAx = this.x
		// const maxBx = x + texture.width
		// const minAy = this.y
		// const maxBy = y + texture.height
		// const maxAy = this.y + this.texture.height
		// const minBy = y

		// return !(
		// 		this.x + this.texture.width < x
		// 	||	x + texture.width < this.x
		// 	||	y + texture.height < this.y
		// 	||	this.y + this.texture.height < y
		// )

		return this.x + this.texture.width >= x
			&& this.x <= x + texture.width
			&& this.y <= y + texture.height
			&& this.y + this.texture.height >= y
	}

	remove() {
		this.engine.sprites.splice(this.engine.sprites.indexOf(this), 1)

		return this
	}
}

class BitmapFont {
	texture: Texture
	height: number
	x = 0
	y = 0
	spaceWidth: number
	horizontalMargin: number
	verticalMargin: number

	characters: Record<string, {
		width: number
		offsetY: number
	}> = {}

	constructor(public engine: Engine, chars: string, texture: Texture, {
		spaceWidth,
		horizontalMargin = 1,
		verticalMargin = 1
	}: Partial<BitmapFont>) {
		this.texture = texture
		this.height = 1
		this.spaceWidth = spaceWidth ?? texture.width
		this.horizontalMargin = horizontalMargin
		this.verticalMargin = verticalMargin

		if (texture.complete)
			this.onLoad(chars)
		else
			texture.addEventListener("load", () => this.onLoad(chars))
	}

	onLoad(chars: string) {
		this.height = (this.texture.height + 1) / (chars.length + 1) - 1
		const canvas = document.createElement("canvas")
		const context = canvas.getContext("2d")

		if (context) {
			canvas.width = this.texture.width
			canvas.height = this.texture.height
			context.drawImage(this.texture, 0, 0)

			this.characters.unknown = { offsetY: 0, width: this.texture.width }

			loop:
			for (let x = this.texture.width; x--;)
				for (let y = 0; y < this.height; y++)
					if (context.getImageData(x, y, 1, 1).data[3]) {
						this.characters.unknown.width = x + 1
						break loop
					}

			for (let i = 0; i < chars.length; i++) {
				const char = {
					offsetY: (this.height + 1) * (i + 1),
					width: this.texture.width
				}

				this.characters[chars[i]] = char

				loop:
				for (let x = this.texture.width; x--;)
					for (
						let y = char.offsetY;
						y < char.offsetY + this.height;
						y++
					) if (context.getImageData(x, y, 1, 1).data[3]) {
						char.width = x + 1
						break loop
					}
			}
		}
	}

	drawCharacter(charStr: string, startX = this.x, startY = this.y) {
		const char = this.characters[charStr] || this.characters.unknown
		const { context } = this.engine

		this.x = startX
		this.y = startY

		if (!char)
			return 0

		context.drawImage(
			this.texture,
			0, char.offsetY,
			char.width, this.height,
			this.x, this.y,
			char.width, this.height
		)

		this.x += char.width + this.horizontalMargin
	}

	drawString(string: string, startX = this.x, startY = this.y) {
		this.x = startX
		this.y = startY

		for (const charStr of string)
			if (charStr == " ")
				this.x += this.spaceWidth
			else if (charStr == "\n") {
				this.y += this.height + this.verticalMargin
				this.x = startX
			} else
				this.drawCharacter(charStr)
	}
}

export function* runScriptsParallel(...scripts: Generator[]) {
	while (scripts.length) {
		const postprocFinished: number[] = []

		for (let i = 0; i < scripts.length; i++)
			scripts[i].next().done &&
				postprocFinished.push(i)

		for (const animationDone of postprocFinished.reverse())
			scripts.splice(animationDone, 1)

		yield
	}
}

export function* runScriptsSequential(...scripts: Generator[]) {
	for (const script of scripts)
		yield* script
}

export function* skipFrames(frames: number) {
	for (let i = 0; i < frames - 1; i++)
		yield
}
