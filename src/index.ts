interface SpriteMouseEvent {
	altKey: boolean;
	button: number;
	ctrlKey: boolean;
	movementX: number;
	movementY: number;
	shiftKey: boolean;
	x: number;
	y: number;
	timeStamp: number
}

interface LooseObject<Value = any> {
	[key: string]: Value | undefined
}

type SpriteMouseEventHandler = (event: SpriteMouseEvent) => any

export class Texture extends Image {
	constructor(public src: string) {
		super()
	}
}

export const txt_missing = new Texture("data:image/png;base64,iVBORw0KGgoAAAANS\
UhEUgAAABAAAAAQCAYAAAAf8/9hAAAAI0lEQVQ4jWP4z/D/Pz7MwMCAH48aMCwMIKSACAtGDRj6BgAA\
MbX+EPmqY6kAAAAASUVORK5CYII=")

const sprites: Sprite[] = []
export const canvas = document.createElement("canvas")
export const context = canvas.getContext("2d")
let scale = 1
export const offset = { x: 0, y: 0 }

export class Sprite {
	x: number
	y: number
	layer: number
	hidden: boolean
	texture: Texture
	onCursorMove?: SpriteMouseEventHandler
	onCursorDown?: SpriteMouseEventHandler
	onCursorUp?: SpriteMouseEventHandler
	onCursorEnter?: SpriteMouseEventHandler
	onCursorLeave?: SpriteMouseEventHandler
	scripts: Generator[]
	width?: number
	height?: number
	index: number
	processes: Generator[]

	constructor({
		x = 0,
		y = 0,
		layer = 0,
		hidden = false,
		texture = txt_missing,
		onCursorDown,
		onCursorEnter,
		onCursorLeave,
		onCursorMove,
		onCursorUp,
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
		this.onCursorDown = onCursorDown
		this.onCursorEnter = onCursorEnter
		this.onCursorLeave = onCursorLeave
		this.onCursorMove = onCursorMove
		this.onCursorUp = onCursorUp
		this.scripts = scripts
		this.width = width
		this.index = index
		this.processes = processes
		this.height = height

		sprites.push(this)
	}

	overlapsPoint(x: number, y: number) {
		return !!this.texture
			&& x > this.x
			&& x < this.x + this.texture.width
			&& y > this.y
			&& y < this.y + this.texture.height
	}

	overlapsSprite({ x, y, texture }: Sprite) {
		return !!texture && (
				this.overlapsPoint(x                , y                 )
			||	this.overlapsPoint(x + texture.width, y                 )
			||	this.overlapsPoint(x                , y + texture.height)
			||	this.overlapsPoint(x + texture.width, y + texture.height)
		)
	}

	remove() {
		sprites.splice(sprites.indexOf(this), 1)
	}
}

export class Charset {
	texture: Texture
	chars: LooseObject<{ width: number, offsetY: number }> = {}
	height: number
	x = 0
	y = 0
	spaceWidth: number
	horMargin: number
	verMargin: number

	constructor(chars: string, { spaceWidth, horMargin = 1, verMargin = 1, texture }: { spaceWidth?: number, horMargin?: number, verMargin?: number, texture: Texture }) {
		this.texture = texture
		this.height = 1
		this.spaceWidth = spaceWidth ?? texture.width
		this.horMargin = horMargin
		this.verMargin = verMargin
		
		const onload = () => {
			this.height = (texture.height + 1) / (chars.length + 1) - 1
			const canvas = document.createElement("canvas")
			const context = canvas.getContext("2d")

			if (context) {
				canvas.width = texture.width
				canvas.height = texture.height
				context.drawImage(texture, 0, 0)

				this.chars.unknown = { offsetY: 0, width: texture.width }

				loop:
				for (let x = texture.width; x--;)
					for (let y = 0; y < this.height; y++)
						if (context.getImageData(x, y, 1, 1).data[3]) {
							this.chars.unknown.width = x + 1
							break loop
						}
				
				for (let i = 0; i < chars.length; i++) {
					const char = { offsetY: (this.height + 1) * (i + 1), width: texture.width }
					this.chars[chars[i]] = char

					loop:
					for (let x = texture.width; x--;)
						for (let y = char.offsetY; y < char.offsetY + this.height; y++)
							if (context.getImageData(x, y, 1, 1).data[3]) {
								char.width = x + 1
								break loop
							}
				}
			}
		}

		if (texture.complete)
			onload()
		else
			texture.onload = onload
	}

	drawChar(charStr: string, startX = this.x, startY = this.y) {
		this.x = startX
		this.y = startY

		if (!context)
			throw new Error("no context :(")

		const char = this.chars[charStr] || this.chars.unknown

		if (!char)
			return 0

		context.drawImage(
			this.texture,
			0, char.offsetY,
			char.width, this.height,
			this.x, this.y,
			char.width, this.height
		)

		this.x += char.width + this.horMargin
	}

	drawString(string: string, startX = this.x, startY = this.y) {
		this.x = startX
		this.y = startY

		for (const charStr of string)
			if (charStr == " ")
				this.x += this.spaceWidth
			else if (charStr == "\n") {
				this.y += this.height + this.verMargin
				this.x = startX
			} else
				this.drawChar(charStr)
	}
}

canvas.onmousemove = ({
	pageX,
	pageY,
	timeStamp,
	altKey,
	buttons,
	ctrlKey,
	movementX,
	movementY,
	shiftKey
}: MouseEvent) => {
	movementX = movementX / scale
	movementY = movementY / scale
	const x = (pageX - canvas.offsetLeft) / scale
	const y = (pageY - canvas.offsetTop) / scale
	const oldX = x - movementX
	const oldY = y - movementY

	const cursorLeaveSprites: Sprite[] = []
	const cursorMoveSprites: Sprite[] = []
	const cursorEnterSprites: Sprite[] = []

	for (const sprite of sprites) {
		const overlapsOldCursorPos = sprite.overlapsPoint(oldX, oldY)
		const overlapsNewCursorPos = sprite.overlapsPoint(x, y)

		if (overlapsOldCursorPos && overlapsNewCursorPos)
			cursorMoveSprites.push(sprite)
		else if (overlapsOldCursorPos)
			cursorLeaveSprites.push(sprite)
		else if (overlapsNewCursorPos)
			cursorEnterSprites.push(sprite)
	}

	for (const sprite of cursorLeaveSprites)
		sprite.onCursorLeave && sprite.onCursorLeave({
			x: x - sprite.x,
			y: y - sprite.y,
			button: buttons,
			altKey, timeStamp, ctrlKey, movementX, movementY,
			shiftKey
		})

	for (const sprite of cursorMoveSprites)
		sprite.onCursorMove && sprite.onCursorMove({
			x: x - sprite.x,
			y: y - sprite.y,
			button: buttons,
			altKey, timeStamp, ctrlKey, movementX, movementY,
			shiftKey
		})

	for (const sprite of cursorEnterSprites)
		sprite.onCursorEnter && sprite.onCursorEnter({
			x: x - sprite.x,
			y: y - sprite.y,
			button: buttons,
			altKey, timeStamp, ctrlKey, movementX, movementY,
			shiftKey
		})
}

canvas.onmouseleave = canvas.onmousemove

canvas.onmousedown = ({
	pageX,
	pageY,
	timeStamp,
	altKey,
	buttons,
	ctrlKey,
	movementX,
	movementY,
	shiftKey
}: MouseEvent) => {
	const x = (pageX - canvas.offsetLeft) / scale
	const y = (pageY - canvas.offsetTop) / scale

	for (const sprite of sprites)
		if (sprite.overlapsPoint(x, y)) {
			sprite.onCursorDown && sprite.onCursorDown({
				x: x - sprite.x,
				y: y - sprite.y,
				altKey,
				timeStamp,
				button: buttons,
				ctrlKey,
				movementX: movementX / scale,
				movementY: movementY / scale,
				shiftKey
			})
		}
}

canvas.onmouseup = ({
	pageX,
	pageY,
	timeStamp,
	altKey,
	buttons,
	ctrlKey,
	movementX,
	movementY,
	shiftKey
}: MouseEvent) => {
	const x = (pageX - canvas.offsetLeft) / scale
	const y = (pageY - canvas.offsetTop) / scale

	for (const sprite of sprites)
		if (sprite.overlapsPoint(x, y)) {
			sprite.onCursorUp && sprite.onCursorUp({
				x: x - sprite.x,
				y: y - sprite.y,
				altKey,
				timeStamp,
				button: buttons,
				ctrlKey,
				movementX: movementX / scale,
				movementY: movementY / scale,
				shiftKey
			})
		}
}

export function autoResize () {
	onResize()
	addEventListener("resize", onResize)
}

function onResize() {
	scale = Math.min(
		innerHeight / canvas.height,
		innerWidth / canvas.width
	)

	if (scale > 1) {
		if (innerHeight < innerWidth)
			scale = Math.floor(scale)
		
		canvas.style.imageRendering = "crisp-edges"
		canvas.style.imageRendering = "pixelated"
	} else
		canvas.style.imageRendering = ""

	canvas.style.height = `${canvas.height * scale}px`
	canvas.style.width = `${canvas.width * scale}px`
}

requestAnimationFrame(main)

function main() {
	if (!context)
		throw new Error("no context :(")

	requestAnimationFrame(main)

	context.clearRect(0, 0, canvas.width, canvas.height)
	sprites.sort((a, b) => a.layer - b.layer)

	for (const sprite of sprites) {
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
				context.drawImage(
					sprite.texture,
					Math.floor(sprite.index % (sprite.texture.width / width)) * width,
					Math.floor(sprite.index / (sprite.texture.width / width)) * height,
					width,
					height,
					sprite.x + offset.x,
					sprite.y + offset.y,
					width,
					height
				)
			else
				context.drawImage(sprite.texture, sprite.x + offset.x, sprite.y + offset.y)
		}
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
